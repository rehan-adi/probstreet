package tests

import (
	"math"
	"testing"
	"time"

	"matching-engine/internals/engine"
	"matching-engine/internals/handlers"
	"matching-engine/internals/types"
)

func TestOrderPlacement_RiskAndLimits(t *testing.T) {
	engine.EngineInstance = &engine.Engine{
		User:   make(map[string]*types.User),
		Market: make(map[string]*types.Market),
	}

	symbol := "RISK-LIMIT-TEST"
	marketId := "m_risk_1"

	handlers.CreateMarket(types.QueuePayload{
		ResponseId: "mkt_r1",
		Data: map[string]interface{}{
			"marketId":        marketId,
			"title":           "Risk Limits Market",
			"symbol":          symbol,
			"yesPrice":        5.0,
			"NoPrice":         5.0,
			"startDate":       time.Now().Format(time.RFC3339),
			"endDate":         time.Now().Add(24 * time.Hour).Format(time.RFC3339),
			"sourceOfTruth":   "Risk Rules",
			"rules":           "Risk Limits",
			"numberOfTraders": int16(0),
		},
	})

	user := &types.User{
		ID:   "u_risk",
		Name: "Risk Tester",
		Balance: &types.Balance{
			WalletBalance: types.WalletBalance{Amount: 100.0, Locked: 0.0},
			StockBalance: map[string]types.StockBalance{
				symbol: {Yes: 5, No: 0},
			},
		},
		LastActive: time.Now(),
	}
	engine.EngineInstance.User[user.ID] = user

	// 1. Unknown user rejected
	respUnknown := handlers.BuyOrder(types.QueuePayload{
		ResponseId: "buy_unk",
		Data: map[string]interface{}{
			"userId":    "non_existent_user",
			"marketId":  marketId,
			"symbol":    symbol,
			"side":      "YES",
			"action":    "BUY",
			"orderType": "LIMIT",
			"price":     5.0,
			"quantity":  10,
		},
	})
	if respUnknown.Status == types.Success {
		t.Fatalf("Expected failure for unknown user")
	}

	// 2. Insufficient balance rejected (needs 600, has 100)
	respNoBal := handlers.BuyOrder(types.QueuePayload{
		ResponseId: "buy_nobal",
		Data: map[string]interface{}{
			"userId":    user.ID,
			"marketId":  marketId,
			"symbol":    symbol,
			"side":      "YES",
			"action":    "BUY",
			"orderType": "LIMIT",
			"price":     6.0,
			"quantity":  100,
		},
	})
	if respNoBal.Status == types.Success {
		t.Fatalf("Expected failure for insufficient balance")
	}

	// 3. Position limit exceeded (> 5000 shares)
	respOverLimit := handlers.BuyOrder(types.QueuePayload{
		ResponseId: "buy_overlim",
		Data: map[string]interface{}{
			"userId":    user.ID,
			"marketId":  marketId,
			"symbol":    symbol,
			"side":      "YES",
			"action":    "BUY",
			"orderType": "LIMIT",
			"price":     5.0,
			"quantity":  5001,
		},
	})
	if respOverLimit.Status == types.Success {
		t.Fatalf("Expected failure for position limit exceeding 5000")
	}

	// 4. Insufficient stocks for SELL (has 5, tries to sell 10)
	respNoStock := handlers.SellOrder(types.QueuePayload{
		ResponseId: "sell_nostock",
		Data: map[string]interface{}{
			"userId":    user.ID,
			"marketId":  marketId,
			"symbol":    symbol,
			"side":      "YES",
			"action":    "SELL",
			"orderType": "LIMIT",
			"price":     6.0,
			"quantity":  10,
		},
	})
	if respNoStock.Status == types.Success {
		t.Fatalf("Expected failure for insufficient stocks")
	}

	// 5. Valid BUY locks funds atomically
	respValidBuy := handlers.BuyOrder(types.QueuePayload{
		ResponseId: "buy_valid",
		Data: map[string]interface{}{
			"userId":    user.ID,
			"orderId":   "ord_valid_buy_1",
			"marketId":  marketId,
			"symbol":    symbol,
			"side":      "YES",
			"action":    "BUY",
			"orderType": "LIMIT",
			"price":     5.0,
			"quantity":  10, // 50 total cost
		},
	})
	if respValidBuy.Status != types.Success {
		t.Fatalf("Expected valid BUY order success: %+v", respValidBuy)
	}

	if user.Balance.WalletBalance.Amount != 50.0 || user.Balance.WalletBalance.Locked != 50.0 {
		t.Errorf("Expected Amount=50, Locked=50, got Amount=%.2f, Locked=%.2f",
			user.Balance.WalletBalance.Amount, user.Balance.WalletBalance.Locked)
	}

	// 6. Valid SELL deducts stock atomically
	respValidSell := handlers.SellOrder(types.QueuePayload{
		ResponseId: "sell_valid",
		Data: map[string]interface{}{
			"userId":    user.ID,
			"orderId":   "ord_valid_sell_1",
			"marketId":  marketId,
			"symbol":    symbol,
			"side":      "YES",
			"action":    "SELL",
			"orderType": "LIMIT",
			"price":     8.0,
			"quantity":  3,
		},
	})
	if respValidSell.Status != types.Success {
		t.Fatalf("Expected valid SELL order success: %+v", respValidSell)
	}
	if user.Balance.StockBalance[symbol].Yes != 2 {
		t.Errorf("Expected remaining YES shares 2, got %d", user.Balance.StockBalance[symbol].Yes)
	}
}

func TestOrderCancellationAndRefunds(t *testing.T) {
	engine.EngineInstance = &engine.Engine{
		User:   make(map[string]*types.User),
		Market: make(map[string]*types.Market),
	}

	symbol := "CANCEL-REFUND-TEST"
	marketId := "m_cancel_1"

	handlers.CreateMarket(types.QueuePayload{
		ResponseId: "mkt_c1",
		Data: map[string]interface{}{
			"marketId":        marketId,
			"title":           "Cancel Refund Market",
			"symbol":          symbol,
			"yesPrice":        5.0,
			"NoPrice":         5.0,
			"startDate":       time.Now().Format(time.RFC3339),
			"endDate":         time.Now().Add(24 * time.Hour).Format(time.RFC3339),
			"sourceOfTruth":   "Refund Rules",
			"rules":           "Refund Rules",
			"numberOfTraders": int16(0),
		},
	})

	user := &types.User{
		ID:   "u_canceller",
		Name: "Canceller",
		Balance: &types.Balance{
			WalletBalance: types.WalletBalance{Amount: 100.0, Locked: 0.0},
			StockBalance: map[string]types.StockBalance{
				symbol: {Yes: 10, No: 0},
			},
		},
		LastActive: time.Now(),
	}
	engine.EngineInstance.User[user.ID] = user

	// Place resting BUY YES @ 4.0 for 10 shares (locks ₹40)
	handlers.BuyOrder(types.QueuePayload{
		ResponseId: "b_ord",
		Data: map[string]interface{}{
			"userId":    user.ID,
			"orderId":   "ord_to_cancel_buy",
			"marketId":  marketId,
			"symbol":    symbol,
			"side":      "YES",
			"action":    "BUY",
			"orderType": "LIMIT",
			"price":     4.0,
			"quantity":  10,
		},
	})

	if user.Balance.WalletBalance.Locked != 40.0 {
		t.Fatalf("Expected Locked 40.0, got %.2f", user.Balance.WalletBalance.Locked)
	}

	// Cancel BUY order -> refunds ₹40 back to Amount
	cancelResp := handlers.CancelOrder(types.QueuePayload{
		ResponseId: "c_resp_1",
		Data: map[string]interface{}{
			"userId":   user.ID,
			"orderId":  "ord_to_cancel_buy",
			"marketId": marketId,
			"symbol":   symbol,
		},
	})
	if cancelResp.Status != types.Success {
		t.Fatalf("Failed to cancel buy order: %+v", cancelResp)
	}

	if user.Balance.WalletBalance.Locked != 0.0 || math.Abs(user.Balance.WalletBalance.Amount-100.0) > 1e-6 {
		t.Errorf("Balance not fully refunded on cancel: %+v", user.Balance.WalletBalance)
	}

	// Place resting SELL YES @ 8.0 for 5 shares (deducts 5 stock)
	handlers.SellOrder(types.QueuePayload{
		ResponseId: "s_ord",
		Data: map[string]interface{}{
			"userId":    user.ID,
			"orderId":   "ord_to_cancel_sell",
			"marketId":  marketId,
			"symbol":    symbol,
			"side":      "YES",
			"action":    "SELL",
			"orderType": "LIMIT",
			"price":     8.0,
			"quantity":  5,
		},
	})

	if user.Balance.StockBalance[symbol].Yes != 5 {
		t.Fatalf("Expected remaining YES stock 5, got %d", user.Balance.StockBalance[symbol].Yes)
	}

	// Cancel SELL order -> refunds 5 stock back
	cancelSellResp := handlers.CancelOrder(types.QueuePayload{
		ResponseId: "c_resp_2",
		Data: map[string]interface{}{
			"userId":   user.ID,
			"orderId":  "ord_to_cancel_sell",
			"marketId": marketId,
			"symbol":   symbol,
		},
	})
	if cancelSellResp.Status != types.Success {
		t.Fatalf("Failed to cancel sell order: %+v", cancelSellResp)
	}

	if user.Balance.StockBalance[symbol].Yes != 10 {
		t.Errorf("Stock not fully refunded on cancel: %d", user.Balance.StockBalance[symbol].Yes)
	}
}

func TestMarketResolutionAndCleanup(t *testing.T) {
	engine.EngineInstance = &engine.Engine{
		User:   make(map[string]*types.User),
		Market: make(map[string]*types.Market),
	}

	symbol := "RESOLVE-CLEANUP-TEST"
	marketId := "m_res_1"

	handlers.CreateMarket(types.QueuePayload{
		ResponseId: "mkt_res_1",
		Data: map[string]interface{}{
			"marketId":        marketId,
			"title":           "Market Resolution Cleanup",
			"symbol":          symbol,
			"yesPrice":        5.0,
			"NoPrice":         5.0,
			"startDate":       time.Now().Format(time.RFC3339),
			"endDate":         time.Now().Add(24 * time.Hour).Format(time.RFC3339),
			"sourceOfTruth":   "Oracle",
			"rules":           "Resolution",
			"numberOfTraders": int16(0),
		},
	})

	user1 := &types.User{
		ID:   "u_res_buyer",
		Name: "Buyer",
		Balance: &types.Balance{
			WalletBalance: types.WalletBalance{Amount: 100.0, Locked: 0.0},
			StockBalance:  make(map[string]types.StockBalance),
		},
		LastActive: time.Now(),
	}
	user2 := &types.User{
		ID:   "u_res_seller",
		Name: "Seller",
		Balance: &types.Balance{
			WalletBalance: types.WalletBalance{Amount: 100.0, Locked: 0.0},
			StockBalance: map[string]types.StockBalance{
				symbol: {Yes: 10, No: 0},
			},
		},
		LastActive: time.Now(),
	}
	engine.EngineInstance.User[user1.ID] = user1
	engine.EngineInstance.User[user2.ID] = user2

	// User 1 places resting Buy YES @ 4.0 for 10 shares (locks ₹40)
	handlers.BuyOrder(types.QueuePayload{
		ResponseId: "res_b1",
		Data: map[string]interface{}{
			"userId":    user1.ID,
			"orderId":   "ord_res_b1",
			"marketId":  marketId,
			"symbol":    symbol,
			"side":      "YES",
			"action":    "BUY",
			"orderType": "LIMIT",
			"price":     4.0,
			"quantity":  10,
		},
	})

	// User 2 places resting Sell YES @ 8.0 for 10 shares (locks 10 shares)
	handlers.SellOrder(types.QueuePayload{
		ResponseId: "res_s1",
		Data: map[string]interface{}{
			"userId":    user2.ID,
			"orderId":   "ord_res_s1",
			"marketId":  marketId,
			"symbol":    symbol,
			"side":      "YES",
			"action":    "SELL",
			"orderType": "LIMIT",
			"price":     8.0,
			"quantity":  10,
		},
	})

	// Resolve market
	resResp := handlers.ResolveMarket(types.QueuePayload{
		ResponseId: "res_event",
		Data: map[string]interface{}{
			"symbol": symbol,
			"result": "YES",
		},
	})
	if resResp.Status != types.Success {
		t.Fatalf("ResolveMarket failed: %+v", resResp)
	}

	// User 1 locked funds must be refunded
	if user1.Balance.WalletBalance.Locked != 0.0 || math.Abs(user1.Balance.WalletBalance.Amount-100.0) > 1e-6 {
		t.Errorf("User 1 balance not refunded on resolution: %+v", user1.Balance.WalletBalance)
	}

	// User 2 stocks must be refunded
	if user2.Balance.StockBalance[symbol].Yes != 10 {
		t.Errorf("User 2 stocks not refunded on resolution: %d", user2.Balance.StockBalance[symbol].Yes)
	}

	// Market status must be closed
	mkt, _ := engine.EngineInstance.GetMarket(symbol)
	if mkt.Status != types.Close {
		t.Errorf("Expected closed market, got %s", mkt.Status)
	}
}
