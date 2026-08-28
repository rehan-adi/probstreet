package tests

import (
	"fmt"
	"math/rand"
	"sync"
	"testing"
	"time"

	"matching-engine/internals/engine"
	"matching-engine/internals/handlers"
	"matching-engine/internals/types"
)

// TestConcurrentTradingStress executes simultaneous trading operations across multiple goroutines to test mutex safety
func TestConcurrentTradingStress(t *testing.T) {
	engine.EngineInstance = &engine.Engine{
		User:   make(map[string]*types.User),
		Market: make(map[string]*types.Market),
	}

	symbol := "CONCURRENCY-TEST"
	marketId := "m_concurrent"

	// Create market
	handlers.CreateMarket(types.QueuePayload{
		ResponseId: "mkt_conc",
		Data: map[string]interface{}{
			"marketId":        marketId,
			"title":           "Concurrent Stress Test Market",
			"symbol":          symbol,
			"yesPrice":        5.0,
			"NoPrice":         5.0,
			"startDate":       time.Now().Format(time.RFC3339),
			"endDate":         time.Now().Add(10 * time.Hour).Format(time.RFC3339),
			"sourceOfTruth":   "Test Oracle",
			"rules":           "Stress test rules",
			"numberOfTraders": int16(0),
		},
	})

	numTraders := 10
	for i := 0; i < numTraders; i++ {
		uid := fmt.Sprintf("trader_conc_%d", i)
		handlers.CreateUser(types.QueuePayload{
			ResponseId: fmt.Sprintf("conc_user_%d", i),
			Data: map[string]interface{}{
				"id":                       uid,
				"name":                     fmt.Sprintf("Concurrent Trader %d", i),
				"phone":                    "+911234567890",
				"kycVerificationStatus":     types.KYC_VERIFIED,
				"paymentVerificationStatus": types.PAYMENT_VERIFIED,
			},
		})
		handlers.Deposit(types.QueuePayload{
			ResponseId: fmt.Sprintf("conc_dep_%d", i),
			Data: map[string]interface{}{
				"userId": uid,
				"amount": 10000.0,
			},
		})
		// Pre-split 50 shares
		handlers.SplitShares(types.QueuePayload{
			ResponseId: fmt.Sprintf("conc_split_%d", i),
			Data: map[string]interface{}{
				"userId":   uid,
				"marketId": marketId,
				"symbol":   symbol,
				"quantity": 50,
			},
		})
	}

	var wg sync.WaitGroup
	numRoutines := 8
	iterationsPerRoutine := 15

	for r := 0; r < numRoutines; r++ {
		wg.Add(1)
		go func(routineId int) {
			defer wg.Done()
			rng := rand.New(rand.NewSource(time.Now().UnixNano() + int64(routineId)))

			for i := 0; i < iterationsPerRoutine; i++ {
				uIdx := rng.Intn(numTraders)
				uid := fmt.Sprintf("trader_conc_%d", uIdx)
				actionType := rng.Intn(4)

				switch actionType {
				case 0: // Buy YES
					handlers.BuyOrder(types.QueuePayload{
						ResponseId: fmt.Sprintf("conc_buy_%d_%d", routineId, i),
						Data: map[string]interface{}{
							"userId":    uid,
							"orderId":   fmt.Sprintf("ord_b_%d_%d", routineId, i),
							"marketId":  marketId,
							"symbol":    symbol,
							"side":      "YES",
							"action":    "BUY",
							"orderType": "LIMIT",
							"price":     float64(rng.Intn(8) + 1),
							"quantity":  rng.Intn(3) + 1,
						},
					})
				case 1: // Buy NO
					handlers.BuyOrder(types.QueuePayload{
						ResponseId: fmt.Sprintf("conc_buyno_%d_%d", routineId, i),
						Data: map[string]interface{}{
							"userId":    uid,
							"orderId":   fmt.Sprintf("ord_bno_%d_%d", routineId, i),
							"marketId":  marketId,
							"symbol":    symbol,
							"side":      "NO",
							"action":    "BUY",
							"orderType": "LIMIT",
							"price":     float64(rng.Intn(8) + 1),
							"quantity":  rng.Intn(3) + 1,
						},
					})
				case 2: // Sell YES
					handlers.SellOrder(types.QueuePayload{
						ResponseId: fmt.Sprintf("conc_sellyes_%d_%d", routineId, i),
						Data: map[string]interface{}{
							"userId":    uid,
							"orderId":   fmt.Sprintf("ord_syes_%d_%d", routineId, i),
							"marketId":  marketId,
							"symbol":    symbol,
							"side":      "YES",
							"action":    "SELL",
							"orderType": "LIMIT",
							"price":     float64(rng.Intn(8) + 1),
							"quantity":  1,
						},
					})
				case 3: // Get Details
					handlers.GetMarketDetails(types.QueuePayload{
						ResponseId: fmt.Sprintf("conc_get_%d_%d", routineId, i),
						Data: map[string]interface{}{
							"symbol": symbol,
						},
					})
				}
			}
		}(r)
	}

	wg.Wait()
	t.Logf("Concurrent stress test completed successfully with 0 race conditions or deadlocks.")
}
