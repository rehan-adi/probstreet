package tests

import (
	"fmt"
	"math"
	"testing"
	"time"

	"matching-engine/internals/engine"
	"matching-engine/internals/handlers"
	"matching-engine/internals/types"
)

// TestE2EMarketAndTradingLifecycle tests the complete lifecycle of users, markets, and trading flows
func TestE2EMarketAndTradingLifecycle(t *testing.T) {
	// Initialize clean engine
	engine.EngineInstance = &engine.Engine{
		User:   make(map[string]*types.User),
		Market: make(map[string]*types.Market),
	}

	symbol := "ICC-CHAMPIONS-TROPHY-2026"
	marketId := "m_icc_2026"

	// 1. Create Market
	mktResp := handlers.CreateMarket(types.QueuePayload{
		ResponseId: "e2e_mkt_1",
		Data: map[string]interface{}{
			"marketId":        marketId,
			"title":           "Will India win the ICC Champions Trophy 2026?",
			"symbol":          symbol,
			"yesPrice":        5.0,
			"NoPrice":         5.0,
			"startDate":       time.Now().Format(time.RFC3339),
			"endDate":         time.Now().Add(60 * 24 * time.Hour).Format(time.RFC3339),
			"sourceOfTruth":   "ICC Official Website",
			"rules":           "Official ICC Tournament match outcome",
			"numberOfTraders": int16(0),
		},
	})
	if mktResp.Status != types.Success {
		t.Fatalf("Failed to create market: %+v", mktResp)
	}

	// 2. Create Users: Alice, Bob, and Liquidity Admin
	users := []struct {
		id      string
		name    string
		deposit float64
	}{
		{"alice", "Alice Trader", 1000.0},
		{"bob", "Bob Trader", 1000.0},
		{"admin", "Market Maker Admin", 50000.0},
	}

	for _, u := range users {
		createResp := handlers.CreateUser(types.QueuePayload{
			ResponseId: fmt.Sprintf("create_%s", u.id),
			Data: map[string]interface{}{
				"id":                       u.id,
				"name":                     u.name,
				"phone":                    "+919999999999",
				"kycVerificationStatus":     types.KYC_VERIFIED,
				"paymentVerificationStatus": types.PAYMENT_VERIFIED,
			},
		})
		if createResp.Status != types.Success {
			t.Fatalf("Failed to create user %s: %+v", u.id, createResp)
		}

		depResp := handlers.Deposit(types.QueuePayload{
			ResponseId: fmt.Sprintf("dep_%s", u.id),
			Data: map[string]interface{}{
				"userId": u.id,
				"amount": u.deposit,
			},
		})
		if depResp.Status != types.Success {
			t.Fatalf("Failed to deposit for %s: %+v", u.id, depResp)
		}
	}

	// 3. Admin seeds liquidity at multiple levels
	liqResp := handlers.AddLiquidity(types.QueuePayload{
		ResponseId: "liq_seed",
		Data: map[string]interface{}{
			"userId":   "admin",
			"marketId": marketId,
			"symbol":   symbol,
			"role":     "admin",
			"levels": []handlers.LiquidityLevel{
				{Price: 4.0, Quantity: 50},
				{Price: 6.0, Quantity: 50},
			},
		},
	})
	if liqResp.Status != types.Success {
		t.Fatalf("Failed to seed liquidity: %+v", liqResp)
	}

	// 4. Alice splits ₹200 to obtain 20 YES and 20 NO shares
	splitResp := handlers.SplitShares(types.QueuePayload{
		ResponseId: "split_alice",
		Data: map[string]interface{}{
			"userId":   "alice",
			"marketId": marketId,
			"symbol":   symbol,
			"quantity": 20,
		},
	})
	if splitResp.Status != types.Success {
		t.Fatalf("Failed to split shares: %+v", splitResp)
	}

	aliceUser := engine.EngineInstance.User["alice"]
	if aliceUser.Balance.StockBalance[symbol].Yes != 20 || aliceUser.Balance.StockBalance[symbol].No != 20 {
		t.Fatalf("Alice stock mismatch after split: %+v", aliceUser.Balance.StockBalance[symbol])
	}
	if math.Abs(aliceUser.Balance.WalletBalance.Amount-800.0) > 1e-6 {
		t.Fatalf("Alice balance expected 800, got %.2f", aliceUser.Balance.WalletBalance.Amount)
	}

	// 5. Alice places a limit SELL YES @ ₹3.50 for 10 shares (cheaper than synthetic price of ₹4.00)
	sellResp := handlers.SellOrder(types.QueuePayload{
		ResponseId: "alice_sell_1",
		Data: map[string]interface{}{
			"userId":    "alice",
			"orderId":   "ord_alice_sell_yes",
			"marketId":  marketId,
			"symbol":    symbol,
			"side":      "YES",
			"action":    "SELL",
			"orderType": "LIMIT",
			"price":     3.5,
			"quantity":  10,
		},
	})
	if sellResp.Status != types.Success {
		t.Fatalf("Alice sell order failed: %+v", sellResp)
	}
	// Alice remaining unlisted YES shares should be 10
	if aliceUser.Balance.StockBalance[symbol].Yes != 10 {
		t.Errorf("Alice remaining YES stock expected 10, got %d", aliceUser.Balance.StockBalance[symbol].Yes)
	}

	// 6. Bob places a limit BUY YES @ ₹3.50 for 10 shares -> STANDARD MATCH with Alice's resting Sell order!
	buyResp := handlers.BuyOrder(types.QueuePayload{
		ResponseId: "bob_buy_1",
		Data: map[string]interface{}{
			"userId":    "bob",
			"orderId":   "ord_bob_buy_yes",
			"marketId":  marketId,
			"symbol":    symbol,
			"side":      "YES",
			"action":    "BUY",
			"orderType": "LIMIT",
			"price":     3.5,
			"quantity":  10,
		},
	})
	if buyResp.Status != types.Success {
		t.Fatalf("Bob buy order failed: %+v", buyResp)
	}

	// Verify Bob received 10 YES shares
	bobUser := engine.EngineInstance.User["bob"]
	if bobUser.Balance.StockBalance[symbol].Yes != 10 {
		t.Errorf("Bob expected 10 YES shares, got %d", bobUser.Balance.StockBalance[symbol].Yes)
	}
	// Alice received ₹35 - fee (0.0025 * 35 = 0.0875) = 34.9125 -> 800 + 34.9125 = 834.9125
	expectedAliceCash := 800.0 + (35.0 - (35.0 * 0.0025))
	if math.Abs(aliceUser.Balance.WalletBalance.Amount-expectedAliceCash) > 1e-4 {
		t.Errorf("Alice cash expected %.4f, got %.4f", expectedAliceCash, aliceUser.Balance.WalletBalance.Amount)
	}

	// 7. Alice merges remaining 10 YES and 10 NO shares back into ₹100 cash
	mergeResp := handlers.MergeShares(types.QueuePayload{
		ResponseId: "alice_merge_1",
		Data: map[string]interface{}{
			"userId":   "alice",
			"marketId": marketId,
			"symbol":   symbol,
			"quantity": 10,
		},
	})
	if mergeResp.Status != types.Success {
		t.Fatalf("Alice merge shares failed: %+v", mergeResp)
	}

	if aliceUser.Balance.StockBalance[symbol].Yes != 0 || aliceUser.Balance.StockBalance[symbol].No != 10 {
		t.Errorf("Alice stock after merge mismatch: %+v", aliceUser.Balance.StockBalance[symbol])
	}
	expectedAliceFinalCash := expectedAliceCash + 100.0
	if math.Abs(aliceUser.Balance.WalletBalance.Amount-expectedAliceFinalCash) > 1e-4 {
		t.Errorf("Alice final cash expected %.4f, got %.4f", expectedAliceFinalCash, aliceUser.Balance.WalletBalance.Amount)
	}

	// 8. Bob withdraws ₹500
	withdrawResp := handlers.Withdraw(types.QueuePayload{
		ResponseId: "bob_withdraw_1",
		Data: map[string]interface{}{
			"userId": "bob",
			"amount": 500.0,
		},
	})
	if withdrawResp.Status != types.Success {
		t.Fatalf("Bob withdrawal failed: %+v", withdrawResp)
	}

	// 9. Resolve Market
	resResp := handlers.ResolveMarket(types.QueuePayload{
		ResponseId: "resolve_mkt_1",
		Data: map[string]interface{}{
			"symbol": symbol,
			"result": "YES",
		},
	})
	if resResp.Status != types.Success {
		t.Fatalf("Market resolution failed: %+v", resResp)
	}

	mkt, _ := engine.EngineInstance.GetMarket(symbol)
	if mkt.Status != types.Close {
		t.Errorf("Market expected to be closed, got %s", mkt.Status)
	}
}
