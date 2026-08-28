package tests

import (
	"math"
	"testing"
	"time"

	"matching-engine/internals/engine"
	"matching-engine/internals/handlers"
	"matching-engine/internals/types"
)

func createTestMarketForHandlers(marketId, symbol string) *types.Market {
	return &types.Market{
		MarketId: marketId,
		Symbol:   symbol,
		Status:   types.Open,
		Inbox:    make(chan types.MarketMessage, 100),
	}
}

func TestSplitShares(t *testing.T) {
	symbol := "SPLIT-TEST"
	market := createTestMarketForHandlers("m_split", symbol)

	engine.EngineInstance = &engine.Engine{
		User:   make(map[string]*types.User),
		Market: make(map[string]*types.Market),
	}
	engine.EngineInstance.Market[symbol] = market

	user := &types.User{
		ID: "u_split",
		Balance: &types.Balance{
			WalletBalance: types.WalletBalance{Amount: 100.0, Locked: 0.0},
			StockBalance:  make(map[string]types.StockBalance),
		},
		LastActive: time.Now(),
	}
	engine.EngineInstance.User[user.ID] = user

	resp := handlers.SplitShares(types.QueuePayload{
		ResponseId: "resp_split_1",
		Data: map[string]interface{}{
			"userId":   user.ID,
			"marketId": market.MarketId,
			"symbol":   symbol,
			"quantity": 5,
		},
	})

	if resp.Status != types.Success {
		t.Fatalf("Expected SplitShares success, got %s: %s", resp.Status, resp.Message)
	}

	if math.Abs(user.Balance.WalletBalance.Amount-50.0) > 1e-6 {
		t.Errorf("Expected remaining INR 50.0, got %.2f", user.Balance.WalletBalance.Amount)
	}

	stock := user.Balance.StockBalance[symbol]
	if stock.Yes != 5 || stock.No != 5 {
		t.Errorf("Expected 5 YES and 5 NO shares, got Yes=%d, No=%d", stock.Yes, stock.No)
	}

	failResp := handlers.SplitShares(types.QueuePayload{
		ResponseId: "resp_split_2",
		Data: map[string]interface{}{
			"userId":   user.ID,
			"marketId": market.MarketId,
			"symbol":   symbol,
			"quantity": 10,
		},
	})
	if failResp.Status == types.Success {
		t.Fatalf("Expected insufficient balance error for SplitShares")
	}
}

func TestMergeShares(t *testing.T) {
	symbol := "MERGE-TEST"
	market := createTestMarketForHandlers("m_merge", symbol)

	engine.EngineInstance = &engine.Engine{
		User:   make(map[string]*types.User),
		Market: make(map[string]*types.Market),
	}
	engine.EngineInstance.Market[symbol] = market

	stockMap := make(map[string]types.StockBalance)
	stockMap[symbol] = types.StockBalance{Yes: 5, No: 5}

	user := &types.User{
		ID: "u_merge",
		Balance: &types.Balance{
			WalletBalance: types.WalletBalance{Amount: 50.0, Locked: 0.0},
			StockBalance:  stockMap,
		},
		LastActive: time.Now(),
	}
	engine.EngineInstance.User[user.ID] = user

	resp := handlers.MergeShares(types.QueuePayload{
		ResponseId: "resp_merge_1",
		Data: map[string]interface{}{
			"userId":   user.ID,
			"marketId": market.MarketId,
			"symbol":   symbol,
			"quantity": 5,
		},
	})

	if resp.Status != types.Success {
		t.Fatalf("Expected MergeShares success, got %s: %s", resp.Status, resp.Message)
	}

	if math.Abs(user.Balance.WalletBalance.Amount-100.0) > 1e-6 {
		t.Errorf("Expected INR to increase to 100.0, got %.2f", user.Balance.WalletBalance.Amount)
	}

	stock := user.Balance.StockBalance[symbol]
	if stock.Yes != 0 || stock.No != 0 {
		t.Errorf("Expected 0 YES and 0 NO shares, got Yes=%d, No=%d", stock.Yes, stock.No)
	}

	failResp := handlers.MergeShares(types.QueuePayload{
		ResponseId: "resp_merge_2",
		Data: map[string]interface{}{
			"userId":   user.ID,
			"marketId": market.MarketId,
			"symbol":   symbol,
			"quantity": 1,
		},
	})
	if failResp.Status == types.Success {
		t.Fatalf("Expected insufficient shares error for MergeShares")
	}
}
