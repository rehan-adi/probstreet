package tests

import (
	"math"
	"testing"
	"time"

	"matching-engine/internals/engine"
	"matching-engine/internals/handlers"
	"matching-engine/internals/types"
)

func setupEngineWithUser(id string, amount, locked float64, kyc types.KycStatus, payment types.PaymentStatus) *types.User {
	engine.EngineInstance = &engine.Engine{
		User:   make(map[string]*types.User),
		Market: make(map[string]*types.Market),
	}

	user := &types.User{
		ID:                        id,
		Name:                      "Test User",
		KycVerificationStatus:     kyc,
		PaymentVerificationStatus: payment,
		Balance: &types.Balance{
			WalletBalance: types.WalletBalance{
				Amount: amount,
				Locked: locked,
			},
			StockBalance: make(map[string]types.StockBalance),
		},
		LastActive: time.Now(),
	}

	engine.EngineInstance.User[id] = user
	return user
}

func TestInitBalance(t *testing.T) {
	setupEngineWithUser("u_init", 0, 0, types.KYC_VERIFIED, types.PAYMENT_VERIFIED)

	payload := types.QueuePayload{
		ResponseId: "resp_1",
		Data: map[string]interface{}{
			"userId": "u_init",
			"amount": 500.0,
			"locked": 50.0,
		},
	}

	resp := handlers.InitBalance(payload)
	if resp.Status != types.Success {
		t.Fatalf("Expected Success, got %s: %s", resp.Status, resp.Message)
	}

	user := engine.EngineInstance.User["u_init"]
	if user.Balance.WalletBalance.Amount != 500.0 || user.Balance.WalletBalance.Locked != 50.0 {
		t.Errorf("Balance mismatch: %+v", user.Balance.WalletBalance)
	}
}

func TestGetBalance(t *testing.T) {
	setupEngineWithUser("u_get", 250.0, 75.0, types.KYC_VERIFIED, types.PAYMENT_VERIFIED)

	payload := types.QueuePayload{
		ResponseId: "resp_2",
		Data: map[string]interface{}{
			"userId": "u_get",
		},
	}

	resp := handlers.GetBalance(payload)
	if resp.Status != types.Success {
		t.Fatalf("Expected Success, got %s: %s", resp.Status, resp.Message)
	}

	data := resp.Data.(map[string]interface{})
	if data["amount"] != 250.0 || data["locked"] != 75.0 {
		t.Errorf("GetBalance data mismatch: %+v", data)
	}
}

func TestDeposit(t *testing.T) {
	user := setupEngineWithUser("u_dep", 100.0, 0.0, types.KYC_VERIFIED, types.PAYMENT_VERIFIED)

	// 1. Negative / 0 amount rejected
	badPayload := types.QueuePayload{
		ResponseId: "resp_3",
		Data: map[string]interface{}{
			"userId": "u_dep",
			"amount": -50.0,
		},
	}
	badResp := handlers.Deposit(badPayload)
	if badResp.Status == types.Success {
		t.Fatalf("Expected error for negative deposit, got success")
	}

	// 2. Valid deposit
	goodPayload := types.QueuePayload{
		ResponseId: "resp_4",
		Data: map[string]interface{}{
			"userId": "u_dep",
			"amount": 150.0,
		},
	}
	goodResp := handlers.Deposit(goodPayload)
	if goodResp.Status != types.Success {
		t.Fatalf("Expected Success for deposit, got %s: %s", goodResp.Status, goodResp.Message)
	}

	if user.Balance.WalletBalance.Amount != 250.0 {
		t.Errorf("Expected balance 250, got %.2f", user.Balance.WalletBalance.Amount)
	}
}

func TestWithdraw_VerificationAndBalanceChecks(t *testing.T) {
	// 1. Unverified user rejected
	unverifiedUser := setupEngineWithUser("u_unverified", 1000.0, 0.0, types.KYC_NOT_VERIFIED, types.PAYMENT_NOT_VERIFIED)
	_ = unverifiedUser

	respUnverified := handlers.Withdraw(types.QueuePayload{
		ResponseId: "resp_5",
		Data: map[string]interface{}{
			"userId": "u_unverified",
			"amount": 100.0,
		},
	})
	if respUnverified.Status == types.Success {
		t.Fatalf("Expected unverified withdrawal to fail")
	}

	// 2. Verified user with insufficient balance rejected
	verifiedUser := setupEngineWithUser("u_verified", 50.0, 0.0, types.KYC_VERIFIED, types.PAYMENT_VERIFIED)
	respOverdraft := handlers.Withdraw(types.QueuePayload{
		ResponseId: "resp_6",
		Data: map[string]interface{}{
			"userId": "u_verified",
			"amount": 100.0,
		},
	})
	if respOverdraft.Status == types.Success {
		t.Fatalf("Expected overdraft withdrawal to fail")
	}

	// 3. Valid withdrawal
	respValid := handlers.Withdraw(types.QueuePayload{
		ResponseId: "resp_7",
		Data: map[string]interface{}{
			"userId": "u_verified",
			"amount": 30.0,
		},
	})
	if respValid.Status != types.Success {
		t.Fatalf("Expected valid withdrawal to succeed, got %s: %s", respValid.Status, respValid.Message)
	}
	if math.Abs(verifiedUser.Balance.WalletBalance.Amount-20.0) > 1e-6 {
		t.Errorf("Expected balance 20.0, got %.2f", verifiedUser.Balance.WalletBalance.Amount)
	}
}
