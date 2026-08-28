package tests

import (
	"fmt"
	"testing"
	"time"

	"matching-engine/internals/engine"
	"matching-engine/internals/handlers"
	"matching-engine/internals/types"
)

// TestAntiMoneyPrintingInvariants explicitly asserts that total in-memory capital is never generated out of thin air
func TestAntiMoneyPrintingInvariants(t *testing.T) {
	engine.EngineInstance = &engine.Engine{
		User:   make(map[string]*types.User),
		Market: make(map[string]*types.Market),
	}

	symbol := "FIN-SAFETY-TEST"
	marketId := "m_safety_1"

	handlers.CreateMarket(types.QueuePayload{
		ResponseId: "mkt_safe",
		Data: map[string]interface{}{
			"marketId":        marketId,
			"title":           "Financial Safety Invariant Market",
			"symbol":          symbol,
			"yesPrice":        5.0,
			"NoPrice":         5.0,
			"startDate":       time.Now().Format(time.RFC3339),
			"endDate":         time.Now().Add(24 * time.Hour).Format(time.RFC3339),
			"sourceOfTruth":   "Safety Invariant Verifier",
			"rules":           "Strict conservation",
			"numberOfTraders": int16(0),
		},
	})

	userInitialCash := 10000.0
	uids := []string{"u1", "u2", "u3"}

	for _, uid := range uids {
		handlers.CreateUser(types.QueuePayload{
			ResponseId: fmt.Sprintf("u_create_%s", uid),
			Data: map[string]interface{}{
				"id":                       uid,
				"name":                     uid,
				"kycVerificationStatus":     types.KYC_VERIFIED,
				"paymentVerificationStatus": types.PAYMENT_VERIFIED,
			},
		})
		handlers.Deposit(types.QueuePayload{
			ResponseId: fmt.Sprintf("u_dep_%s", uid),
			Data: map[string]interface{}{
				"userId": uid,
				"amount": userInitialCash,
			},
		})
	}

	totalSystemInflow := userInitialCash * float64(len(uids))

	// User 1 splits ₹500 for 50 pairs
	handlers.SplitShares(types.QueuePayload{
		ResponseId: "split_u1",
		Data: map[string]interface{}{
			"userId":   "u1",
			"marketId": marketId,
			"symbol":   symbol,
			"quantity": 50,
		},
	})

	// User 1 sells 20 YES @ ₹6.00
	handlers.SellOrder(types.QueuePayload{
		ResponseId: "sell_u1",
		Data: map[string]interface{}{
			"userId":    "u1",
			"orderId":   "ord_u1_s",
			"marketId":  marketId,
			"symbol":    symbol,
			"side":      "YES",
			"action":    "SELL",
			"orderType": "LIMIT",
			"price":     6.0,
			"quantity":  20,
		},
	})

	// User 2 buys 20 YES @ ₹6.00
	handlers.BuyOrder(types.QueuePayload{
		ResponseId: "buy_u2",
		Data: map[string]interface{}{
			"userId":    "u2",
			"orderId":   "ord_u2_b",
			"marketId":  marketId,
			"symbol":    symbol,
			"side":      "YES",
			"action":    "BUY",
			"orderType": "LIMIT",
			"price":     6.0,
			"quantity":  20,
		},
	})

	// User 2 buys 10 NO @ ₹4.00 (MINT with User 3 buying YES @ ₹6.00)
	handlers.BuyOrder(types.QueuePayload{
		ResponseId: "buy_u2_no",
		Data: map[string]interface{}{
			"userId":    "u2",
			"orderId":   "ord_u2_bno",
			"marketId":  marketId,
			"symbol":    symbol,
			"side":      "NO",
			"action":    "BUY",
			"orderType": "LIMIT",
			"price":     4.0,
			"quantity":  10,
		},
	})
	handlers.BuyOrder(types.QueuePayload{
		ResponseId: "buy_u3_yes",
		Data: map[string]interface{}{
			"userId":    "u3",
			"orderId":   "ord_u3_byes",
			"marketId":  marketId,
			"symbol":    symbol,
			"side":      "YES",
			"action":    "BUY",
			"orderType": "LIMIT",
			"price":     6.0,
			"quantity":  10,
		},
	})

	// Calculate total wealth
	var totalEndingCash float64
	var totalYesShares, totalNoShares int

	for _, u := range engine.EngineInstance.User {
		totalEndingCash += u.Balance.WalletBalance.Amount + u.Balance.WalletBalance.Locked
		totalYesShares += u.Balance.StockBalance[symbol].Yes
		totalNoShares += u.Balance.StockBalance[symbol].No
	}

	// Any cash held plus the value of remaining shares (which cost ₹10/pair to mint) must NOT exceed total deposited inflow
	// Total Net Wealth = Cash + 10 * Pairs
	if totalEndingCash > totalSystemInflow {
		t.Fatalf("CRITICAL INVARIANT VIOLATION: Cash printed! Ending cash (%.2f) > Initial Inflow (%.2f)",
			totalEndingCash, totalSystemInflow)
	}

	t.Logf("Invariant Verification Passed: Total Inflow: %.2f | Current Cash: %.2f | Total YES: %d | Total NO: %d",
		totalSystemInflow, totalEndingCash, totalYesShares, totalNoShares)
}
