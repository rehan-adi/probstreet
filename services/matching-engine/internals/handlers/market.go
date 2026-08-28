package handlers

import (
	"encoding/json"
	"fmt"
	"matching-engine/internals/engine"
	"matching-engine/internals/types"
	"matching-engine/internals/utils"
	"time"

	"github.com/mitchellh/mapstructure"
	"github.com/rs/zerolog/log"
)

type CreateMarketDataRequest struct {
	ID              string  `mapstructure:"marketId"`
	Title           string  `mapstructure:"title"`
	Symbol          string  `mapstructure:"symbol"`
	YesPrice        float32 `mapstructure:"yesPrice"`
	NoPrice         float32 `mapstructure:"NoPrice"`
	EOS             string  `mapstructure:"eos"`
	Rules           string  `mapstructure:"rules"`
	Thumbnail       string  `mapstructure:"thumbnail"`
	CategoryId      string  `mapstructure:"categoryId"`
	StartDate       string  `mapstructure:"startDate"`
	EndDate         string  `mapstructure:"endDate"`
	SourceOfTruth   string  `mapstructure:"sourceOfTruth"`
	NumberOfTraders int16   `mapstructure:"numberOfTraders"`
}

type GetMarketDetailsDataRequest struct {
	Symbol string `json:"symbol"`
}

func CreateMarket(payload types.QueuePayload) types.QueueResponse {
	var data CreateMarketDataRequest

	if err := mapstructure.Decode(payload.Data, &data); err != nil {
		log.Error().
			Err(err).
			Str("responseId", payload.ResponseId).
			Msg("Failed to decode payload")
		return types.QueueResponse{
			ResponseId: payload.ResponseId,
			Status:     types.Error,
			Message:    "Invalid data structure",
			Retryable:  true,
		}
	}

	startTime, err := time.Parse(time.RFC3339, data.StartDate)

	if err != nil {
		log.Error().Err(err).Msg("Invalid startDate format")
		return types.QueueResponse{
			ResponseId: payload.ResponseId,
			Status:     types.Error,
			Message:    "Invalid startDate format",
			Retryable:  false,
		}
	}

	endTime, err := time.Parse(time.RFC3339, data.EndDate)

	if err != nil {
		log.Error().Err(err).Msg("Invalid endDate format")
		return types.QueueResponse{
			ResponseId: payload.ResponseId,
			Status:     types.Error,
			Message:    "Invalid endDate format",
			Retryable:  false,
		}
	}

	market := &types.Market{
		MarketId:        data.ID,
		Title:           data.Title,
		Symbol:          data.Symbol,
		YesPrice:        data.YesPrice,
		NoPrice:         data.NoPrice,
		Thumbnail:       data.Thumbnail,
		CategoryId:      data.CategoryId,
		NumberOfTraders: data.NumberOfTraders,
		Traders:         make(map[string]struct{}),
		Volume:          0,
		Status:          types.Open,
		Inbox:           make(chan types.MarketMessage, 100),
		OrderBook: &types.OrderBook{
			YesBids: &types.BidHeap{OrderHeap: make(types.OrderHeap, 0)},
			YesAsks: &types.AskHeap{OrderHeap: make(types.OrderHeap, 0)},
			NoBids:  &types.BidHeap{OrderHeap: make(types.OrderHeap, 0)},
			NoAsks:  &types.AskHeap{OrderHeap: make(types.OrderHeap, 0)},
		},
		Overview: types.Overview{
			SourceOfTruth: data.SourceOfTruth,
			StartDate:     startTime,
			EndDate:       endTime,
			EOS:           data.EOS,
			Rules:         data.Rules,
		},
	}

	engine.EngineInstance.AddMarket(market)

	// Broadcast initial TICKER so clients see the default 5.0/5.0 price immediately
	tickerPayload := map[string]interface{}{
		"type":            "TICKER",
		"symbol":          market.Symbol,
		"yesPrice":        market.YesPrice,
		"noPrice":         market.NoPrice,
		"volume":          market.Volume,
		"numberOfTraders": market.NumberOfTraders,
	}
	if tickerData, err := json.Marshal(tickerPayload); err == nil {
		engine.EngineInstance.BroadcastMessage("stream:data", string(tickerData))
	}

	log.Info().
		Str("marketId", data.ID).
		Msg("Market created and added to engine")

	return types.QueueResponse{
		ResponseId: payload.ResponseId,
		Status:     types.Success,
		Message:    "Market created",
	}
}

func GetMarketDetails(payload types.QueuePayload) types.QueueResponse {

	var data GetMarketDetailsDataRequest

	if err := mapstructure.Decode(payload.Data, &data); err != nil {
		return types.QueueResponse{
			ResponseId: payload.ResponseId,
			Status:     types.Error,
			Message:    "Invalid format",
		}
	}

	engine.EngineInstance.MM.RLock()
	market, ok := engine.EngineInstance.Market[data.Symbol]
	engine.EngineInstance.MM.RUnlock()

	if !ok {
		return types.QueueResponse{
			ResponseId: payload.ResponseId,
			Status:     types.Error,
			Message:    "Market not found",
		}
	}

	orderBook, ok := engine.EngineInstance.GetOrderBook(market.Symbol)

	if !ok {
		orderBook = types.AggregatedOrderBook{
			Yes: make([]types.PriceQuantity, 0),
			No:  make([]types.PriceQuantity, 0),
		}
		fmt.Println("Order book is empty")
	}

	log.Info().
		Str("marketId", market.MarketId).
		Int("YesOrders", len(orderBook.Yes)).
		Int("NoOrders", len(orderBook.No)).
		Msg("Fetched order book")

	return types.QueueResponse{
		ResponseId: payload.ResponseId,
		Status:     types.Success,
		Message:    "Market details fetched successfully",
		Data: struct {
			MarketId        string                     `json:"marketId"`
			Title           string                     `json:"title"`
			Symbol          string                     `json:"symbol"`
			CategoryId      string                     `json:"categoryId"`
			YesPrice        float32                    `json:"yesPrice"`
			NoPrice         float32                    `json:"noPrice"`
			Thumbnail       string                     `json:"thumbnail"`
			EOS             string                     `json:"eos"`
			Rules           string                     `json:"rules"`
			Volume          float64                    `json:"volume"`
			Status          string                     `json:"status"`
			OrderBook       types.AggregatedOrderBook  `json:"orderbook"`
			Overview        types.Overview             `json:"overview"`
			Trades          []types.TradeExecutedEvent `json:"trades"`
			NumberOfTraders int16                      `json:"numberOfTraders"`
		}{
			MarketId:        market.MarketId,
			Title:           market.Title,
			Symbol:          market.Symbol,
			CategoryId:      market.CategoryId,
			Volume:          market.Volume,
			YesPrice:        market.YesPrice,
			Thumbnail:       market.Thumbnail,
			EOS:             market.Overview.EOS,
			Rules:           market.Overview.Rules,
			NoPrice:         market.NoPrice,
			Status:          string(market.Status),
			OrderBook:       orderBook,
			Overview:        market.Overview,
			Trades:          market.Trades,
			NumberOfTraders: market.NumberOfTraders,
		},
	}
}

type LiquidityLevel struct {
	Price    float64 `mapstructure:"price"`
	Quantity int     `mapstructure:"quantity"`
}

type AddLiquidityDataRequest struct {
	UserId   string           `mapstructure:"userId"`
	Phone    string           `mapstructure:"phone"`
	MarketId string           `mapstructure:"marketId"`
	Symbol   string           `mapstructure:"symbol"`
	Role     string           `mapstructure:"role"`
	Levels   []LiquidityLevel `mapstructure:"levels"`
}

func AddLiquidity(payload types.QueuePayload) types.QueueResponse {

	var data AddLiquidityDataRequest

	if err := mapstructure.Decode(payload.Data, &data); err != nil {
		log.Error().
			Err(err).
			Interface("payload", payload.Data).
			Msg("Failed to decode payload data request")
		return types.QueueResponse{
			ResponseId: payload.ResponseId,
			Status:     types.Error,
			Retryable:  false,
			Message:    "failed to validate payload data " + err.Error(),
		}
	}

	market, ok := engine.EngineInstance.GetMarket(data.Symbol)

	if !ok {
		return types.QueueResponse{
			ResponseId: payload.ResponseId,
			Status:     types.Error,
			Retryable:  false,
			Message:    "Market not found for liquidity seeding",
		}
	}

	if market.Status == types.Close {
		return types.QueueResponse{
			ResponseId: payload.ResponseId,
			Status:     types.Error,
			Retryable:  false,
			Message:    "Market is closed",
		}
	}

	// Default levels if none provided
	levels := data.Levels
	if len(levels) == 0 {
		levels = []LiquidityLevel{
			{Price: 3.0, Quantity: 10},
			{Price: 4.0, Quantity: 25},
			{Price: 5.0, Quantity: 50},
			{Price: 6.0, Quantity: 25},
			{Price: 7.0, Quantity: 10},
		}
	}

	// Place BUY YES and BUY NO at each price level.
	// When a real user buys YES at price P, it can MINT-match with a BUY NO at (10-P).
	// This creates proper two-sided liquidity without needing SELL orders.
	totalOrders := 0
	for _, level := range levels {
		replyYes := make(chan interface{}, 1)
		replyNo := make(chan interface{}, 1)

		yesOrder := types.Order{
			OrderId:   utils.GenerateOrderID(),
			UserId:    data.UserId,
			MarketId:  data.MarketId,
			Symbol:    data.Symbol,
			Side:      types.Yes,
			Price:     level.Price,
			Role:      types.ADMIN,
			Quantity:  level.Quantity,
			Action:    types.BUY,
			OrderType: types.LIMIT,
			Timestamp: time.Now().UTC(),
		}

		noOrder := types.Order{
			OrderId:   utils.GenerateOrderID(),
			UserId:    data.UserId,
			MarketId:  data.MarketId,
			Symbol:    data.Symbol,
			Side:      types.No,
			Price:     level.Price,
			Role:      types.ADMIN,
			Quantity:  level.Quantity,
			Action:    types.BUY,
			OrderType: types.LIMIT,
			Timestamp: time.Now().UTC(),
		}

		market.Inbox <- types.MarketMessage{
			Type:      types.MarketPlaceOrder,
			Payload:   yesOrder,
			ReplyChan: replyYes,
		}
		<-replyYes

		market.Inbox <- types.MarketMessage{
			Type:      types.MarketPlaceOrder,
			Payload:   noOrder,
			ReplyChan: replyNo,
		}
		<-replyNo

		totalOrders += 2
	}

	log.Info().
		Str("symbol", data.Symbol).
		Int("totalOrders", totalOrders).
		Int("levels", len(levels)).
		Msg("Multi-level liquidity seeded successfully")

	return types.QueueResponse{
		ResponseId: payload.ResponseId,
		Status:     types.Success,
		Message:    fmt.Sprintf("Liquidity seeded: %d orders across %d levels", totalOrders, len(levels)),
	}

}

type ResolveMarketDataRequest struct {
	Symbol string `mapstructure:"symbol"`
	Result string `mapstructure:"result"`
}

func ResolveMarket(payload types.QueuePayload) types.QueueResponse {
	var data ResolveMarketDataRequest

	if err := mapstructure.Decode(payload.Data, &data); err != nil {
		return types.QueueResponse{
			ResponseId: payload.ResponseId,
			Status:     types.Error,
			Message:    "Invalid format",
		}
	}

	engine.EngineInstance.MM.RLock()
	market, ok := engine.EngineInstance.GetMarket(data.Symbol)
	engine.EngineInstance.MM.RUnlock()

	if !ok {
		return types.QueueResponse{
			ResponseId: payload.ResponseId,
			Status:     types.Error,
			Message:    "Market not found",
		}
	}

	replyChan := make(chan interface{})
	market.Inbox <- types.MarketMessage{
		Type:      types.MarketResolveMarket,
		Payload:   data.Result,
		ReplyChan: replyChan,
	}

	resp := <-replyChan
	if respBool, ok := resp.(bool); ok && respBool {
		return types.QueueResponse{
			ResponseId: payload.ResponseId,
			Status:     types.Success,
			Message:    "Market resolved",
		}
	}

	return types.QueueResponse{
		ResponseId: payload.ResponseId,
		Status:     types.Error,
		Message:    "Failed to resolve market",
	}
}
