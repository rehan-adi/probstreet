package tests

import (
	"testing"
	"time"

	"matching-engine/internals/engine"
	"matching-engine/internals/handlers"
	"matching-engine/internals/types"
)

func TestUserAndVerificationHandlers(t *testing.T) {
	engine.EngineInstance = &engine.Engine{
		User:   make(map[string]*types.User),
		Market: make(map[string]*types.Market),
	}

	createResp := handlers.CreateUser(types.QueuePayload{
		ResponseId: "u_resp_1",
		Data: map[string]interface{}{
			"id":                       "u_100",
			"name":                     "Alice Developer",
			"phone":                    "+919876543210",
			"kycVerificationStatus":     types.KYC_NOT_VERIFIED,
			"paymentVerificationStatus": types.PAYMENT_NOT_VERIFIED,
		},
	})
	if createResp.Status != types.Success {
		t.Fatalf("Expected CreateUser success, got: %+v", createResp)
	}

	user, exists := engine.EngineInstance.User["u_100"]
	if !exists || user.Name != "Alice Developer" {
		t.Fatalf("User not correctly created in engine: %+v", user)
	}

	verifyResp := handlers.UpdateVerificationStatus(types.QueuePayload{
		ResponseId: "u_resp_2",
		Data: map[string]interface{}{
			"userId":        "u_100",
			"kycStatus":     "VERIFIED",
			"paymentStatus": "VERIFIED",
		},
	})
	if verifyResp.Status != types.Success {
		t.Fatalf("Expected UpdateVerificationStatus success, got: %+v", verifyResp)
	}
	if user.KycVerificationStatus != types.KYC_VERIFIED || user.PaymentVerificationStatus != types.PAYMENT_VERIFIED {
		t.Errorf("Verification status not updated properly: kyc=%s payment=%s",
			user.KycVerificationStatus, user.PaymentVerificationStatus)
	}
}

func TestMarketAndLiquidityLifecycleHandlers(t *testing.T) {
	engine.EngineInstance = &engine.Engine{
		User:   make(map[string]*types.User),
		Market: make(map[string]*types.Market),
	}

	createMktResp := handlers.CreateMarket(types.QueuePayload{
		ResponseId: "mkt_resp_1",
		Data: map[string]interface{}{
			"marketId":        "m_test_1",
			"title":           "Will Bitcoin cross $150k in 2026?",
			"symbol":          "BTC-150K",
			"yesPrice":        5.0,
			"NoPrice":         5.0,
			"startDate":       time.Now().Format(time.RFC3339),
			"endDate":         time.Now().Add(30 * 24 * time.Hour).Format(time.RFC3339),
			"sourceOfTruth":   "CoinMarketCap",
			"rules":           "Standard settlement rules",
			"numberOfTraders": int16(0),
		},
	})
	if createMktResp.Status != types.Success {
		t.Fatalf("Expected CreateMarket success, got: %+v", createMktResp)
	}

	adminUser := &types.User{
		ID:   "admin_user",
		Name: "Liquidity Provider Admin",
		Balance: &types.Balance{
			WalletBalance: types.WalletBalance{Amount: 100000.0, Locked: 0.0},
			StockBalance:  make(map[string]types.StockBalance),
		},
	}
	traderUser := &types.User{
		ID:   "trader_bob",
		Name: "Bob Trader",
		Balance: &types.Balance{
			WalletBalance: types.WalletBalance{Amount: 500.0, Locked: 0.0},
			StockBalance:  make(map[string]types.StockBalance),
		},
	}
	engine.EngineInstance.User[adminUser.ID] = adminUser
	engine.EngineInstance.User[traderUser.ID] = traderUser

	liqResp := handlers.AddLiquidity(types.QueuePayload{
		ResponseId: "liq_resp_1",
		Data: map[string]interface{}{
			"userId":   adminUser.ID,
			"marketId": "m_test_1",
			"symbol":   "BTC-150K",
			"role":     "admin",
			"levels": []handlers.LiquidityLevel{
				{Price: 4.0, Quantity: 20},
				{Price: 6.0, Quantity: 20},
			},
		},
	})
	if liqResp.Status != types.Success {
		t.Fatalf("Expected AddLiquidity success, got: %+v", liqResp)
	}

	buyResp := handlers.BuyOrder(types.QueuePayload{
		ResponseId: "buy_resp_1",
		Data: map[string]interface{}{
			"userId":    traderUser.ID,
			"orderId":   "ord_trader_buy",
			"marketId":  "m_test_1",
			"symbol":    "BTC-150K",
			"side":      "YES",
			"action":    "BUY",
			"orderType": "LIMIT",
			"price":     6.0,
			"quantity":  5,
		},
	})
	if buyResp.Status != types.Success {
		t.Fatalf("Expected BuyOrder success, got: %+v", buyResp)
	}

	detailsResp := handlers.GetMarketDetails(types.QueuePayload{
		ResponseId: "details_resp_1",
		Data: map[string]interface{}{
			"symbol": "BTC-150K",
		},
	})
	if detailsResp.Status != types.Success {
		t.Fatalf("Expected GetMarketDetails success, got: %+v", detailsResp)
	}

	resolveResp := handlers.ResolveMarket(types.QueuePayload{
		ResponseId: "res_resp_1",
		Data: map[string]interface{}{
			"symbol": "BTC-150K",
			"result": "YES",
		},
	})
	if resolveResp.Status != types.Success {
		t.Fatalf("Expected ResolveMarket success, got: %+v", resolveResp)
	}
}
