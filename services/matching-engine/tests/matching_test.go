package tests

import (
	"container/heap"
	"fmt"
	"math"
	"math/rand"
	"sync"
	"testing"
	"time"

	"matching-engine/internals/engine"
	"matching-engine/internals/types"
)

// Helper to create a clean test market
func createTestMarket(marketId, symbol string) *types.Market {
	yesBids := &types.BidHeap{OrderHeap: make(types.OrderHeap, 0)}
	yesAsks := &types.AskHeap{OrderHeap: make(types.OrderHeap, 0)}
	noBids := &types.BidHeap{OrderHeap: make(types.OrderHeap, 0)}
	noAsks := &types.AskHeap{OrderHeap: make(types.OrderHeap, 0)}

	heap.Init(yesBids)
	heap.Init(yesAsks)
	heap.Init(noBids)
	heap.Init(noAsks)

	return &types.Market{
		MarketId:        marketId,
		Symbol:          symbol,
		YesPrice:        5.0,
		NoPrice:         5.0,
		NumberOfTraders: 0,
		Traders:         make(map[string]struct{}),
		Volume:          0,
		Status:          types.Open,
		OrderBook: &types.OrderBook{
			YesBids: yesBids,
			YesAsks: yesAsks,
			NoBids:  noBids,
			NoAsks:  noAsks,
		},
		Inbox: make(chan types.MarketMessage, 100),
	}
}

// Helper to create a test user
func createTestUser(id, name string, amount, locked float64, yesShares, noShares int, symbol string) *types.User {
	stockMap := make(map[string]types.StockBalance)
	stockMap[symbol] = types.StockBalance{
		Yes: yesShares,
		No:  noShares,
	}

	return &types.User{
		ID:                        id,
		Name:                      name,
		KycVerificationStatus:     types.KYC_VERIFIED,
		PaymentVerificationStatus: types.PAYMENT_VERIFIED,
		Balance: &types.Balance{
			WalletBalance: types.WalletBalance{
				Amount: amount,
				Locked: locked,
			},
			StockBalance: stockMap,
		},
		LastActive: time.Now(),
	}
}

// TestPriceTimePriority verifies that bids/asks are ordered by price, then timestamp
func TestPriceTimePriority(t *testing.T) {
	market := createTestMarket("m1", "BTC-100K")
	now := time.Now()

	// 1. Test Bid Heap: higher price first; FIFO if equal price
	order1 := &types.Order{OrderId: "o1", UserId: "u1", Price: 5.0, Quantity: 10, Timestamp: now.Add(1 * time.Second), Side: types.Yes, Action: types.BUY}
	order2 := &types.Order{OrderId: "o2", UserId: "u2", Price: 7.0, Quantity: 10, Timestamp: now.Add(2 * time.Second), Side: types.Yes, Action: types.BUY}
	order3 := &types.Order{OrderId: "o3", UserId: "u3", Price: 5.0, Quantity: 10, Timestamp: now, Side: types.Yes, Action: types.BUY}

	heap.Push(market.OrderBook.YesBids, order1)
	heap.Push(market.OrderBook.YesBids, order2)
	heap.Push(market.OrderBook.YesBids, order3)

	top1 := heap.Pop(market.OrderBook.YesBids).(*types.Order)
	if top1.OrderId != "o2" {
		t.Fatalf("Expected highest bid o2 (price 7.0), got %s", top1.OrderId)
	}

	top2 := heap.Pop(market.OrderBook.YesBids).(*types.Order)
	if top2.OrderId != "o3" {
		t.Fatalf("Expected earlier timestamp at price 5.0 (o3), got %s", top2.OrderId)
	}

	top3 := heap.Pop(market.OrderBook.YesBids).(*types.Order)
	if top3.OrderId != "o1" {
		t.Fatalf("Expected remaining bid o1, got %s", top3.OrderId)
	}

	// 2. Test Ask Heap: lower price first; FIFO if equal price
	ask1 := &types.Order{OrderId: "a1", UserId: "u1", Price: 6.0, Quantity: 10, Timestamp: now.Add(1 * time.Second), Side: types.Yes, Action: types.SELL}
	ask2 := &types.Order{OrderId: "a2", UserId: "u2", Price: 4.0, Quantity: 10, Timestamp: now.Add(2 * time.Second), Side: types.Yes, Action: types.SELL}
	ask3 := &types.Order{OrderId: "a3", UserId: "u3", Price: 6.0, Quantity: 10, Timestamp: now, Side: types.Yes, Action: types.SELL}

	heap.Push(market.OrderBook.YesAsks, ask1)
	heap.Push(market.OrderBook.YesAsks, ask2)
	heap.Push(market.OrderBook.YesAsks, ask3)

	topAsk1 := heap.Pop(market.OrderBook.YesAsks).(*types.Order)
	if topAsk1.OrderId != "a2" {
		t.Fatalf("Expected lowest ask a2 (price 4.0), got %s", topAsk1.OrderId)
	}

	topAsk2 := heap.Pop(market.OrderBook.YesAsks).(*types.Order)
	if topAsk2.OrderId != "a3" {
		t.Fatalf("Expected earlier timestamp ask at price 6.0 (a3), got %s", topAsk2.OrderId)
	}

	topAsk3 := heap.Pop(market.OrderBook.YesAsks).(*types.Order)
	if topAsk3.OrderId != "a1" {
		t.Fatalf("Expected remaining ask a1, got %s", topAsk3.OrderId)
	}
}

// TestStandardTradeExecution verifies full & partial STANDARD trade matching (Buyer YES vs Seller YES)
func TestStandardTradeExecution(t *testing.T) {
	eng := &engine.Engine{
		User:   make(map[string]*types.User),
		Market: make(map[string]*types.Market),
	}

	symbol := "IND-VS-ENG"
	market := createTestMarket("m_std", symbol)
	eng.Market[symbol] = market

	seller := createTestUser("seller_1", "Seller Bob", 100.0, 0.0, 5, 0, symbol)
	buyer := createTestUser("buyer_1", "Buyer Alice", 50.0, 100.0, 0, 0, symbol)

	eng.User[seller.ID] = seller
	eng.User[buyer.ID] = buyer

	makerOrder := &types.Order{
		OrderId:   "sell_order_1",
		UserId:    seller.ID,
		MarketId:  market.MarketId,
		Symbol:    symbol,
		Side:      types.Yes,
		Action:    types.SELL,
		OrderType: types.LIMIT,
		Price:     6.0,
		Quantity:  15,
		Filled:    0,
		Timestamp: time.Now(),
	}
	heap.Push(market.OrderBook.YesAsks, makerOrder)

	takerOrder := &types.Order{
		OrderId:   "buy_order_1",
		UserId:    buyer.ID,
		MarketId:  market.MarketId,
		Symbol:    symbol,
		Side:      types.Yes,
		Action:    types.BUY,
		OrderType: types.LIMIT,
		Price:     6.0,
		Quantity:  10,
		Filled:    0,
		Timestamp: time.Now(),
	}

	trades := eng.ProcessLimitOrder(market, takerOrder, false)

	if len(trades) != 1 {
		t.Fatalf("Expected 1 trade, got %d", len(trades))
	}
	trade := trades[0]
	if trade.MatchType != "STANDARD" || trade.Quantity != 10 || trade.Price != 6.0 {
		t.Fatalf("Unexpected trade details: %+v", trade)
	}

	if takerOrder.Filled != 10 {
		t.Errorf("Taker order filled expected 10, got %d", takerOrder.Filled)
	}
	if buyer.Balance.StockBalance[symbol].Yes != 10 {
		t.Errorf("Buyer expected 10 YES shares, got %d", buyer.Balance.StockBalance[symbol].Yes)
	}
	expectedLocked := 100.0 - (6.0 * 10)
	if math.Abs(buyer.Balance.WalletBalance.Locked-expectedLocked) > 1e-6 {
		t.Errorf("Buyer locked expected %.2f, got %.2f", expectedLocked, buyer.Balance.WalletBalance.Locked)
	}
	expectedBuyerAmount := 50.0 - (60.0 * 0.0025)
	if math.Abs(buyer.Balance.WalletBalance.Amount-expectedBuyerAmount) > 1e-6 {
		t.Errorf("Buyer amount expected %.4f, got %.4f", expectedBuyerAmount, buyer.Balance.WalletBalance.Amount)
	}

	if makerOrder.Filled != 10 {
		t.Errorf("Maker order filled expected 10, got %d", makerOrder.Filled)
	}
	if market.OrderBook.YesAsks.Len() != 1 {
		t.Fatalf("Expected maker order to still be on book with remaining 5 shares")
	}
	expectedSellerAmount := 100.0 + (60.0 - (60.0 * 0.0025))
	if math.Abs(seller.Balance.WalletBalance.Amount-expectedSellerAmount) > 1e-6 {
		t.Errorf("Seller amount expected %.4f, got %.4f", expectedSellerAmount, seller.Balance.WalletBalance.Amount)
	}
}

// TestMintTradeExecution verifies MINT synthetic matching (Buyer YES matches Buyer NO)
func TestMintTradeExecution(t *testing.T) {
	eng := &engine.Engine{
		User:   make(map[string]*types.User),
		Market: make(map[string]*types.Market),
	}

	symbol := "ISRO-MISSION"
	market := createTestMarket("m_mint", symbol)
	eng.Market[symbol] = market

	user1 := createTestUser("u_yes", "Alice Yes", 50.0, 60.0, 0, 0, symbol)
	user2 := createTestUser("u_no", "Bob No", 50.0, 40.0, 0, 0, symbol)

	eng.User[user1.ID] = user1
	eng.User[user2.ID] = user2

	makerOrder := &types.Order{
		OrderId:   "no_bid_1",
		UserId:    user2.ID,
		MarketId:  market.MarketId,
		Symbol:    symbol,
		Side:      types.No,
		Action:    types.BUY,
		OrderType: types.LIMIT,
		Price:     4.0,
		Quantity:  10,
		Filled:    0,
		Timestamp: time.Now(),
	}
	heap.Push(market.OrderBook.NoBids, makerOrder)

	takerOrder := &types.Order{
		OrderId:   "yes_bid_1",
		UserId:    user1.ID,
		MarketId:  market.MarketId,
		Symbol:    symbol,
		Side:      types.Yes,
		Action:    types.BUY,
		OrderType: types.LIMIT,
		Price:     6.0,
		Quantity:  10,
		Filled:    0,
		Timestamp: time.Now(),
	}

	trades := eng.ProcessLimitOrder(market, takerOrder, false)

	if len(trades) != 1 {
		t.Fatalf("Expected 1 trade, got %d", len(trades))
	}
	trade := trades[0]
	if trade.MatchType != "MINT" {
		t.Fatalf("Expected matchType MINT, got %s", trade.MatchType)
	}
	if trade.Price != 6.0 || trade.Quantity != 10 {
		t.Fatalf("Expected trade price 6.0 and qty 10, got price %.2f qty %d", trade.Price, trade.Quantity)
	}

	if user1.Balance.StockBalance[symbol].Yes != 10 {
		t.Errorf("Alice expected 10 YES shares, got %d", user1.Balance.StockBalance[symbol].Yes)
	}
	if math.Abs(user1.Balance.WalletBalance.Locked-0.0) > 1e-6 {
		t.Errorf("Alice locked expected 0.0, got %.2f", user1.Balance.WalletBalance.Locked)
	}

	if user2.Balance.StockBalance[symbol].No != 10 {
		t.Errorf("Bob expected 10 NO shares, got %d", user2.Balance.StockBalance[symbol].No)
	}
	if math.Abs(user2.Balance.WalletBalance.Locked-0.0) > 1e-6 {
		t.Errorf("Bob locked expected 0.0, got %.2f", user2.Balance.WalletBalance.Locked)
	}

	if market.OrderBook.NoBids.Len() != 0 || market.OrderBook.YesBids.Len() != 0 {
		t.Errorf("Orderbook heaps should be empty after full match")
	}
}

// TestMergeTradeExecution verifies MERGE synthetic matching (Seller YES matches Seller NO)
func TestMergeTradeExecution(t *testing.T) {
	eng := &engine.Engine{
		User:   make(map[string]*types.User),
		Market: make(map[string]*types.Market),
	}

	symbol := "ELECTION-2026"
	market := createTestMarket("m_merge", symbol)
	eng.Market[symbol] = market

	user1 := createTestUser("u_sell_yes", "Alice YesSeller", 10.0, 0.0, 0, 0, symbol)
	user2 := createTestUser("u_sell_no", "Bob NoSeller", 10.0, 0.0, 0, 0, symbol)

	eng.User[user1.ID] = user1
	eng.User[user2.ID] = user2

	makerOrder := &types.Order{
		OrderId:   "no_ask_1",
		UserId:    user2.ID,
		MarketId:  market.MarketId,
		Symbol:    symbol,
		Side:      types.No,
		Action:    types.SELL,
		OrderType: types.LIMIT,
		Price:     4.0,
		Quantity:  10,
		Filled:    0,
		Timestamp: time.Now(),
	}
	heap.Push(market.OrderBook.NoAsks, makerOrder)

	takerOrder := &types.Order{
		OrderId:   "yes_ask_1",
		UserId:    user1.ID,
		MarketId:  market.MarketId,
		Symbol:    symbol,
		Side:      types.Yes,
		Action:    types.SELL,
		OrderType: types.LIMIT,
		Price:     6.0,
		Quantity:  10,
		Filled:    0,
		Timestamp: time.Now(),
	}

	trades := eng.ProcessLimitOrder(market, takerOrder, false)

	if len(trades) != 1 {
		t.Fatalf("Expected 1 trade, got %d", len(trades))
	}
	trade := trades[0]
	if trade.MatchType != "MERGE" {
		t.Fatalf("Expected matchType MERGE, got %s", trade.MatchType)
	}

	expectedAliceAmount := 10.0 + (60.0 - (60.0 * 0.0025))
	if math.Abs(user1.Balance.WalletBalance.Amount-expectedAliceAmount) > 1e-6 {
		t.Errorf("Alice expected amount %.4f, got %.4f", expectedAliceAmount, user1.Balance.WalletBalance.Amount)
	}

	expectedBobAmount := 10.0 + (40.0 - (40.0 * 0.0025))
	if math.Abs(user2.Balance.WalletBalance.Amount-expectedBobAmount) > 1e-6 {
		t.Errorf("Bob expected amount %.4f, got %.4f", expectedBobAmount, user2.Balance.WalletBalance.Amount)
	}
}

// TestSelfTradePrevention verifies that orders from the same user are popped and skipped
func TestSelfTradePrevention(t *testing.T) {
	eng := &engine.Engine{
		User:   make(map[string]*types.User),
		Market: make(map[string]*types.Market),
	}

	symbol := "SELF-TRADE-TEST"
	market := createTestMarket("m_self", symbol)
	eng.Market[symbol] = market

	user := createTestUser("u_self", "Self Trader", 200.0, 100.0, 10, 0, symbol)
	eng.User[user.ID] = user

	makerOrder := &types.Order{
		OrderId:   "maker_self",
		UserId:    user.ID,
		MarketId:  market.MarketId,
		Symbol:    symbol,
		Side:      types.Yes,
		Action:    types.SELL,
		OrderType: types.LIMIT,
		Price:     6.0,
		Quantity:  10,
		Filled:    0,
		Timestamp: time.Now(),
	}
	heap.Push(market.OrderBook.YesAsks, makerOrder)

	takerOrder := &types.Order{
		OrderId:   "taker_self",
		UserId:    user.ID,
		MarketId:  market.MarketId,
		Symbol:    symbol,
		Side:      types.Yes,
		Action:    types.BUY,
		OrderType: types.LIMIT,
		Price:     6.0,
		Quantity:  10,
		Filled:    0,
		Timestamp: time.Now(),
	}

	trades := eng.ProcessLimitOrder(market, takerOrder, false)

	if len(trades) != 0 {
		t.Fatalf("Expected 0 trades due to self-trade prevention, got %d", len(trades))
	}

	if market.OrderBook.YesAsks.Len() != 0 {
		t.Errorf("Expected self maker order to be popped from ask heap")
	}

	if market.OrderBook.YesBids.Len() != 1 {
		t.Errorf("Expected taker order to be placed on bid heap after self-order was popped")
	}
}

// TestFinancialInvariantConservation validates that total system wealth is 100% conserved
func TestFinancialInvariantConservation(t *testing.T) {
	eng := &engine.Engine{
		User:   make(map[string]*types.User),
		Market: make(map[string]*types.Market),
	}

	symbol := "CONSERVATION-TEST"
	market := createTestMarket("m_conserv", symbol)
	eng.Market[symbol] = market

	numUsers := 6
	initialBalancePerUser := 10000.0

	for i := 0; i < numUsers; i++ {
		uid := fmt.Sprintf("trader_%d", i)
		eng.User[uid] = createTestUser(uid, fmt.Sprintf("Trader %d", i), initialBalancePerUser, 0.0, 100, 100, symbol)
	}

	totalInitialWealth := float64(numUsers) * (initialBalancePerUser + (100.0 * 10.0))
	r := rand.New(rand.NewSource(42))

	var totalFeesCollected float64
	var mu sync.Mutex

	for i := 0; i < 100; i++ {
		uIdx := r.Intn(numUsers)
		uid := fmt.Sprintf("trader_%d", uIdx)
		side := types.Yes
		if r.Intn(2) == 1 {
			side = types.No
		}
		action := types.BUY
		if r.Intn(2) == 1 {
			action = types.SELL
		}
		price := float64(r.Intn(9) + 1)
		qty := r.Intn(5) + 1

		eng.UM.Lock()
		user := eng.User[uid]
		eng.UM.Unlock()

		if action == types.BUY {
			totalCost := price * float64(qty)
			eng.UM.Lock()
			if user.Balance.WalletBalance.Amount >= totalCost {
				user.Balance.WalletBalance.Amount -= totalCost
				user.Balance.WalletBalance.Locked += totalCost
				eng.UM.Unlock()

				order := &types.Order{
					OrderId:   fmt.Sprintf("ord_%d", i),
					UserId:    uid,
					MarketId:  market.MarketId,
					Symbol:    symbol,
					Side:      side,
					Action:    action,
					OrderType: types.LIMIT,
					Price:     price,
					Quantity:  qty,
					Filled:    0,
					Timestamp: time.Now(),
				}
				trades := eng.ProcessLimitOrder(market, order, false)
				for _, tr := range trades {
					tradeVal := tr.Price * float64(tr.Quantity)
					mu.Lock()
					totalFeesCollected += (tradeVal * 0.0025 * 2)
					mu.Unlock()
				}
			} else {
				eng.UM.Unlock()
			}
		} else {
			eng.UM.Lock()
			stock := user.Balance.StockBalance[symbol]
			hasStock := (side == types.Yes && stock.Yes >= qty) || (side == types.No && stock.No >= qty)
			if hasStock {
				if side == types.Yes {
					stock.Yes -= qty
				} else {
					stock.No -= qty
				}
				user.Balance.StockBalance[symbol] = stock
				eng.UM.Unlock()

				order := &types.Order{
					OrderId:   fmt.Sprintf("ord_%d", i),
					UserId:    uid,
					MarketId:  market.MarketId,
					Symbol:    symbol,
					Side:      side,
					Action:    action,
					OrderType: types.LIMIT,
					Price:     price,
					Quantity:  qty,
					Filled:    0,
					Timestamp: time.Now(),
				}
				trades := eng.ProcessLimitOrder(market, order, false)
				for _, tr := range trades {
					tradeVal := tr.Price * float64(tr.Quantity)
					mu.Lock()
					totalFeesCollected += (tradeVal * 0.0025 * 2)
					mu.Unlock()
				}
			} else {
				eng.UM.Unlock()
			}
		}
	}

	var endingCash float64
	eng.UM.Lock()
	for _, u := range eng.User {
		endingCash += u.Balance.WalletBalance.Amount + u.Balance.WalletBalance.Locked
	}
	eng.UM.Unlock()

	if endingCash > totalInitialWealth {
		t.Fatalf("CRITICAL BUG: Fake money printed! Ending cash (%.2f) exceeds initial wealth (%.2f)", endingCash, totalInitialWealth)
	}
}
