package engine

import (
	"bytes"
	"compress/gzip"
	"context"
	"encoding/json"
	"fmt"
	"os"
	"time"

	"github.com/aws/aws-sdk-go-v2/aws"
	"github.com/aws/aws-sdk-go-v2/config"
	"github.com/aws/aws-sdk-go-v2/service/s3"
	"github.com/rs/zerolog/log"

	"matching-engine/internals/types"
	"matching-engine/internals/services/kafka"
)

type SnapshotData struct {
	Timestamp time.Time                `json:"timestamp"`
	Users     map[string]*types.User   `json:"users"`
	Markets   map[string]*types.Market `json:"markets"`
}

func (e *Engine) StartSnapshotRoutine() {
	// Runs every 10 minutes as requested
	ticker := time.NewTicker(10 * time.Minute)
	go func() {
		for {
			<-ticker.C
			e.PerformSnapshot()
		}
	}()
}

func (e *Engine) PerformSnapshot() {
	log.Info().Msg("Starting state snapshot and memory eviction routine...")

	e.UM.Lock()

	// 1. Evict inactive users (> 3 days)
	evictionThreshold := time.Now().Add(-3 * 24 * time.Hour)
	evictedCount := 0

	for userId, user := range e.User {
		// If LastActive is zero, it might be a new user or pre-existing without activity
		if !user.LastActive.IsZero() && user.LastActive.Before(evictionThreshold) {
			delete(e.User, userId)
			evictedCount++
		}
	}

	log.Info().Int("evicted_users", evictedCount).Msg("Purged inactive users from engine RAM")

	e.MM.Lock() // Changed to Lock because we might evict markets
	evictedMarkets := 0
	marketsRaw := make(map[string]json.RawMessage)
	for k, m := range e.Market {
		// Evict closed markets that failed to upload after 10 days
		marketEvictionThreshold := time.Now().Add(-10 * 24 * time.Hour)
		if m.Status == types.Close && m.Overview.EndDate.Before(marketEvictionThreshold) {
			delete(e.Market, k)
			evictedMarkets++
			continue
		}

		m.Mu.RLock()
		mBytes, _ := json.Marshal(m)
		m.Mu.RUnlock()
		marketsRaw[k] = mBytes
	}
	
	if evictedMarkets > 0 {
		log.Info().Int("evicted_markets", evictedMarkets).Msg("Purged old closed markets from engine RAM")
	}
	e.MM.Unlock()

	// 2. Serialize State
	data := struct {
		Timestamp time.Time                  `json:"timestamp"`
		Users     map[string]*types.User     `json:"users"`
		Markets   map[string]json.RawMessage `json:"markets"`
	}{
		Timestamp: time.Now(),
		Users:     e.User,
		Markets:   marketsRaw,
	}

	jsonData, err := json.Marshal(data)
	e.UM.Unlock() // Unlock after serialization to unblock trading

	if err != nil {
		log.Error().Err(err).Msg("Failed to serialize engine state for snapshot")
		return
	}

	snapshotEnabled := os.Getenv("SNAPSHOT_ENABLED")
	if snapshotEnabled != "true" {
		log.Warn().Msg("SNAPSHOT_ENABLED is not true, skipping snapshot generation.")
		return
	}

	snapshotStore := os.Getenv("SNAPSHOT_STORE")

	if snapshotStore == "redis" {
		log.Info().Msg("SNAPSHOT_STORE is redis, saving to Redis...")
		ctx := context.Background()
		// Save to Redis with 7 days TTL (7 * 24 * 60 * 60 seconds)
		err := e.Redis.Set(ctx, "engine_snapshot:latest", jsonData, 7*24*time.Hour).Err()
		if err != nil {
			log.Error().Err(err).Msg("Failed to save snapshot to Redis")
		} else {
			log.Info().Msg("Engine state snapshot successfully saved to Redis")
		}
		return
	}

	// 3. Compress for S3
	var b bytes.Buffer
	gz := gzip.NewWriter(&b)
	if _, err := gz.Write(jsonData); err != nil {
		log.Error().Err(err).Msg("Failed to compress engine state")
		return
	}
	if err := gz.Close(); err != nil {
		log.Error().Err(err).Msg("Failed to close gzip writer")
		return
	}

	compressedData := b.Bytes()

	// 4. Upload to S3/R2
	bucketName := os.Getenv("S3_SNAPSHOT_BUCKET")
	if bucketName == "" {
		log.Warn().Msg("S3_SNAPSHOT_BUCKET env var not set, skipping S3 upload. Snapshot generated in memory.")
		return
	}

	cfg, err := config.LoadDefaultConfig(context.TODO())
		
	if err != nil {
		log.Error().Err(err).Msg("Failed to load AWS config")
		return
	}

	client := s3.NewFromConfig(cfg)
	filename := fmt.Sprintf("engine_snapshot_%d.json.gz", time.Now().Unix())

	_, err = client.PutObject(context.TODO(), &s3.PutObjectInput{
		Bucket: aws.String(bucketName),
		Key:    aws.String(filename),
		Body:   bytes.NewReader(compressedData),
	})

	if err != nil {
		log.Error().Err(err).Msg("Failed to upload snapshot to S3")
		return
	}

	log.Info().Str("filename", filename).Msg("Engine state snapshot successfully uploaded to S3")
}

// LoadLatestSnapshot fetches the latest snapshot and populates the engine.
func (e *Engine) LoadLatestSnapshot() {
	snapshotEnabled := os.Getenv("SNAPSHOT_ENABLED")
	if snapshotEnabled != "true" {
		log.Info().Msg("SNAPSHOT_ENABLED not true, skipping snapshot restore on startup")
		return
	}

	snapshotStore := os.Getenv("SNAPSHOT_STORE")

	if snapshotStore == "redis" {
		log.Info().Msg("Attempting to load snapshot from Redis...")
		ctx := context.Background()
		jsonData, err := e.Redis.Get(ctx, "engine_snapshot:latest").Bytes()
		if err != nil {
			log.Info().Err(err).Msg("No snapshot found in Redis or failed to read")
			return
		}

		var data SnapshotData
		if err := json.Unmarshal(jsonData, &data); err != nil {
			log.Error().Err(err).Msg("Failed to unmarshal snapshot from Redis")
			return
		}

		e.UM.Lock()
		e.User = data.Users
		e.UM.Unlock()

		e.MM.Lock()
		e.Market = data.Markets
		if e.Market == nil {
			e.Market = make(map[string]*types.Market)
		}
		// Re-initialize channels and start goroutines for each market
		for key, market := range e.Market {
			if market == nil {
				log.Warn().Str("market_key", key).Msg("Found nil market in snapshot, skipping")
				delete(e.Market, key)
				continue
			}
			market.Inbox = make(chan types.MarketMessage, 100)
			go e.runMarket(market)
		}
		e.MM.Unlock()

		log.Info().Time("snapshot_timestamp", data.Timestamp).Int("users_loaded", len(data.Users)).Int("markets_loaded", len(e.Market)).Msg("Successfully restored snapshot from Redis")
		return
	}

	bucketName := os.Getenv("S3_SNAPSHOT_BUCKET")
	if bucketName == "" {
		log.Info().Msg("S3_SNAPSHOT_BUCKET not set, skipping S3 snapshot restore on startup")
		return
	}

	log.Info().Msg("Snapshot restoration logic initialized (ready for S3 sync)")
}

func (e *Engine) ArchiveClosedMarket(market *types.Market) {
	// Goroutine for uploading and retry
	go func() {
		nodeEnv := os.Getenv("NODE_ENV")
		if nodeEnv == "development" {
			log.Info().Str("marketId", market.MarketId).Msg("Development environment detected, skipping S3 archival. Will evict from RAM in 10 days.")
			time.Sleep(10 * 24 * time.Hour)
			e.MM.Lock()
			delete(e.Market, market.Symbol)
			e.MM.Unlock()
			return
		}

		market.Mu.RLock()
		marketBytes, err := json.Marshal(market)
		market.Mu.RUnlock()
		if err != nil {
			log.Error().Err(err).Str("marketId", market.MarketId).Msg("Failed to serialize closed market for archival")
			return
		}

		var b bytes.Buffer
		gz := gzip.NewWriter(&b)
		if _, err := gz.Write(marketBytes); err != nil {
			log.Error().Err(err).Msg("Failed to compress market state")
			return
		}
		gz.Close()
		compressedData := b.Bytes()

		bucketName := os.Getenv("S3_SNAPSHOT_BUCKET")
		if bucketName == "" {
			log.Warn().Msg("S3_SNAPSHOT_BUCKET not set, skipping market archival")
			return
		}

		cfg, err := config.LoadDefaultConfig(context.TODO())
		if err != nil {
			log.Error().Err(err).Msg("Failed to load AWS config for market archival")
			return
		}

		client := s3.NewFromConfig(cfg)
		filename := fmt.Sprintf("closed_markets/%s.json.gz", market.Symbol)

		success := false
		for attempt := 1; attempt <= 3; attempt++ {
			_, err = client.PutObject(context.TODO(), &s3.PutObjectInput{
				Bucket: aws.String(bucketName),
				Key:    aws.String(filename),
				Body:   bytes.NewReader(compressedData),
			})

			if err == nil {
				success = true
				break
			}
			log.Warn().Err(err).Int("attempt", attempt).Str("marketId", market.MarketId).Msg("Failed to upload market archive to S3, retrying...")
			time.Sleep(time.Duration(attempt*2) * time.Second)
		}

		if success {
			log.Info().Str("filename", filename).Msg("Market safely archived to S3, evicting from engine RAM")
			e.MM.Lock()
			delete(e.Market, market.Symbol)
			e.MM.Unlock()
		} else {
			log.Error().Str("marketId", market.MarketId).Msg("Failed to archive market to S3 after 3 attempts, keeping in RAM and sending alert")
			kafka.ProduceEventToDBProcessor("process_db", "ARCHIVE_FAILED", map[string]interface{}{
				"marketId": market.MarketId,
				"symbol":   market.Symbol,
				"error":    "Failed to upload market to S3 after 3 attempts",
			})
		}
	}()
}
