package engine

import (
	"encoding/json"
	"matching-engine/internals/services/kafka"
	"matching-engine/internals/types"
	"matching-engine/internals/utils"
	"math"
	"time"

	"github.com/rs/zerolog/log"
)

func (e *Engine) handleOrder(msg types.MarketMessage, market *types.Market) {
	order, ok := msg.Payload.(types.Order)
	if !ok {
		msg.ReplyChan <- types.OrderResponse{Success: false, Message: "invalid payload"}
		return
	}

	isAdmin := order.Role == types.ADMIN
	e.UM.Lock()
	user, exists := e.User[order.UserId]
	if !exists {
		e.UM.Unlock()
		msg.ReplyChan <- types.OrderResponse{Success: false, Message: "user not found"}
		return
	}

	user.LastActive = time.Now()

	if user.Balance.StockBalance == nil {
		user.Balance.StockBalance = make(map[string]types.StockBalance)
	}

	// Risk Check
	isMarketOrder := order.OrderType == types.MARKET
	if order.Action == types.BUY {
		if isMarketOrder {
			order.Price = 10.0
		}
		totalCost := order.Price * float64(order.Quantity)
		if !isAdmin {
			// Check Position Limit (Max 5000 shares = ₹50k exposure)
			stock := user.Balance.StockBalance[order.Symbol]
			currentShares := stock.Yes
			if order.Side == types.No {
				currentShares = stock.No
			}
			if currentShares+order.Quantity > 5000 {
				e.UM.Unlock()
				msg.ReplyChan <- types.OrderResponse{Success: false, Message: "position limit exceeded (max 5000 shares)", Data: currentShares}
				return
			}

			if user.Balance.WalletBalance.Amount < totalCost {
				e.UM.Unlock()
				msg.ReplyChan <- types.OrderResponse{Success: false, Message: "insufficient balance", Data: user.Balance.WalletBalance.Amount}
				return
			}
			user.Balance.WalletBalance.Amount -= totalCost
			user.Balance.WalletBalance.Locked += totalCost
		}
	} else { // SELL
		if isMarketOrder {
			order.Price = 0.0
		}
		if !isAdmin {
			stock := user.Balance.StockBalance[order.Symbol]
			availableQty := stock.Yes
			if order.Side == types.No {
				availableQty = stock.No
			}
			if availableQty < order.Quantity {
				e.UM.Unlock()
				msg.ReplyChan <- types.OrderResponse{Success: false, Message: "insufficient stocks", Data: availableQty}
				return
			}
			if order.Side == types.Yes {
				stock.Yes -= order.Quantity
			} else {
				stock.No -= order.Quantity
			}
			user.Balance.StockBalance[order.Symbol] = stock
		}
	}
	e.UM.Unlock()

	market.Mu.Lock()
	if _, exists := market.Traders[order.UserId]; !exists {
		market.Traders[order.UserId] = struct{}{}
		market.NumberOfTraders++
		kafka.ProduceEventToDBProcessor("process_db", string(types.INCREASE_TRADERS_COUNT), map[string]interface{}{"marketId": order.MarketId, "count": 1})
	}
	market.Mu.Unlock()

	// Match Engine execution
	activities := e.ProcessLimitOrder(market, &order, isMarketOrder)

	// Post trade stuff
	kafka.ProduceEventToDBProcessor("process_db", string(types.ORDER_PLACED), map[string]interface{}{
		"orderId": order.OrderId, "marketId": order.MarketId, "symbol": order.Symbol,
		"userId": order.UserId, "side": string(order.Side), "action": string(order.Action),
		"price": order.Price, "originalQuantity": order.Quantity, "filledQuantity": order.Filled,
		"timestamp": time.Now(),
	})

	market.Mu.Lock()
	if len(activities) > 0 {
		market.Trades = append(market.Trades, activities...)
		if len(market.Trades) > 50 {
			market.Trades = market.Trades[len(market.Trades)-50:]
		}
		for _, act := range activities {
			market.Volume += float64(act.Quantity * 10)
			kafka.ProduceEventToDBProcessor("process_db", string(types.TRADE_EXECUTED), act)
		}
	}

	// Broadcast Orderbook update
	aggOrderBook := utils.AggregateOrderBook(market.OrderBook)
	probability := utils.GetYesProbability(aggOrderBook)
	yesPrice := math.Round(probability*10*2) / 2
	noPrice := math.Round((1-probability)*10*2) / 2

	if yesPrice != float64(market.YesPrice) || noPrice != float64(market.NoPrice) {
		market.YesPrice = float32(yesPrice)
		market.NoPrice = float32(noPrice)
		kafka.ProduceEventToDBProcessor("process_db", string(types.UPDATE_STOCK_PRICE), map[string]interface{}{
			"marketId": order.MarketId, "yesPrice": yesPrice, "noPrice": noPrice,
		})
	}
	currentVolume := market.Volume
	currentTraders := market.NumberOfTraders
	market.Mu.Unlock()

	// Broadcast TICKER update (lightweight)
	tickerPayload := map[string]interface{}{
		"type":            "TICKER",
		"symbol":          order.Symbol,
		"yesPrice":        yesPrice,
		"noPrice":         noPrice,
		"volume":          currentVolume,
		"numberOfTraders": currentTraders,
	}
	if tickerData, err := json.Marshal(tickerPayload); err == nil {
		e.BroadcastMessage("stream:data", string(tickerData))
	}

	// Broadcast ORDERBOOK diff update
	diffOrderBook := utils.CalculateOrderBookDiff(market.PreviousOrderBook, aggOrderBook)
	market.PreviousOrderBook = aggOrderBook
	if len(diffOrderBook.Yes) > 0 || len(diffOrderBook.No) > 0 {
		orderbookPayload := map[string]interface{}{
			"type":      "ORDERBOOK",
			"symbol":    order.Symbol,
			"orderbook": diffOrderBook,
		}
		if obData, err := json.Marshal(orderbookPayload); err == nil {
			e.BroadcastMessage("stream:data", string(obData))
		}
	}

	// Broadcast ACTIVITY (Trades) update if any trades occurred
	if len(activities) > 0 {
		activityPayload := map[string]interface{}{
			"type":   "ACTIVITY",
			"symbol": order.Symbol,
			"trades": activities,
		}
		if actData, err := json.Marshal(activityPayload); err == nil {
			e.BroadcastMessage("stream:data", string(actData))
		}
	}

	log.Info().Str("marketId", market.MarketId).Str("type", string(order.OrderType)).Int("filled", order.Filled).Msg("Order processed")

	msg.ReplyChan <- types.OrderResponse{Success: true, Message: "order processed", Data: order}
}

func (e *Engine) GetOrderBook(symbol string) (types.AggregatedOrderBook, bool) {
	e.MM.RLock()
	market, ok := e.Market[symbol]
	e.MM.RUnlock()

	if !ok {
		return types.AggregatedOrderBook{}, false
	}

	replyChan := make(chan interface{})
	market.Inbox <- types.MarketMessage{Type: types.MarketGetOrderBook, ReplyChan: replyChan}
	resp := <-replyChan

	aggOrderBook, ok := resp.(types.AggregatedOrderBook)
	if !ok {
		return types.AggregatedOrderBook{}, false
	}
	return aggOrderBook, true
}

func (e *Engine) handleResolveMarket(msg types.MarketMessage, market *types.Market) {
	result, ok := msg.Payload.(string)
	if !ok {
		msg.ReplyChan <- false
		return
	}

	market.Mu.Lock()
	market.Status = types.Close

	// Cancel all YES bids (BUY YES)
	for _, order := range market.OrderBook.YesBids.OrderHeap {
		refund := order.Price * float64(order.Quantity-order.Filled)
		e.UM.Lock()
		e.User[order.UserId].Balance.WalletBalance.Locked -= refund
		e.User[order.UserId].Balance.WalletBalance.Amount += refund
		e.UM.Unlock()
		kafka.ProduceEventToDBProcessor("process_db", "ORDER_CANCELLED", map[string]interface{}{"userId": order.UserId, "orderId": order.OrderId, "refund": refund, "type": "INR", "marketId": market.MarketId})
	}
	// Cancel all NO bids (BUY NO)
	for _, order := range market.OrderBook.NoBids.OrderHeap {
		refund := order.Price * float64(order.Quantity-order.Filled)
		e.UM.Lock()
		e.User[order.UserId].Balance.WalletBalance.Locked -= refund
		e.User[order.UserId].Balance.WalletBalance.Amount += refund
		e.UM.Unlock()
		kafka.ProduceEventToDBProcessor("process_db", "ORDER_CANCELLED", map[string]interface{}{"userId": order.UserId, "orderId": order.OrderId, "refund": refund, "type": "INR", "marketId": market.MarketId})
	}

	// Cancel all YES asks (SELL YES)
	for _, order := range market.OrderBook.YesAsks.OrderHeap {
		refund := order.Quantity - order.Filled
		e.UM.Lock()
		stock := e.User[order.UserId].Balance.StockBalance[market.Symbol]
		stock.Yes += refund
		e.User[order.UserId].Balance.StockBalance[market.Symbol] = stock
		e.UM.Unlock()
		kafka.ProduceEventToDBProcessor("process_db", "ORDER_CANCELLED", map[string]interface{}{"userId": order.UserId, "orderId": order.OrderId, "refund": refund, "type": "YES_STOCK", "marketId": market.MarketId})
	}
	// Cancel all NO asks (SELL NO)
	for _, order := range market.OrderBook.NoAsks.OrderHeap {
		refund := order.Quantity - order.Filled
		e.UM.Lock()
		stock := e.User[order.UserId].Balance.StockBalance[market.Symbol]
		stock.No += refund
		e.User[order.UserId].Balance.StockBalance[market.Symbol] = stock
		e.UM.Unlock()
		kafka.ProduceEventToDBProcessor("process_db", "ORDER_CANCELLED", map[string]interface{}{"userId": order.UserId, "orderId": order.OrderId, "refund": refund, "type": "NO_STOCK", "marketId": market.MarketId})
	}

	// Clear orderbook
	market.OrderBook.YesBids.OrderHeap = make(types.OrderHeap, 0)
	market.OrderBook.NoBids.OrderHeap = make(types.OrderHeap, 0)
	market.OrderBook.YesAsks.OrderHeap = make(types.OrderHeap, 0)
	market.OrderBook.NoAsks.OrderHeap = make(types.OrderHeap, 0)

	market.Mu.Unlock()

	// Tell DB to finalize payout
	kafka.ProduceEventToDBProcessor("process_db", "MARKET_RESOLVED", map[string]interface{}{
		"marketId": market.MarketId,
		"result":   result,
	})

	log.Info().Str("marketId", market.MarketId).Str("result", result).Msg("Market resolved and closed")
	msg.ReplyChan <- true

	// Kick off background archival
	e.ArchiveClosedMarket(market)
}

func (e *Engine) handleCancelOrder(msg types.MarketMessage, market *types.Market) {
	req, ok := msg.Payload.(types.CancelOrderPayload)
	if !ok {
		msg.ReplyChan <- types.OrderResponse{Success: false, Message: "invalid payload"}
		return
	}

	market.Mu.Lock()
	defer market.Mu.Unlock()

	var foundOrder *types.Order
	var refund float64
	var refundType string

	removeFromHeap := func(h *types.OrderHeap) *types.Order {
		for i, order := range *h {
			if order.OrderId == req.OrderId {
				found := order
				*h = append((*h)[:i], (*h)[i+1:]...)
				return found
			}
		}
		return nil
	}

	if foundOrder = removeFromHeap(&market.OrderBook.YesBids.OrderHeap); foundOrder != nil {
		refund = foundOrder.Price * float64(foundOrder.Quantity-foundOrder.Filled)
		refundType = "INR"
	} else if foundOrder = removeFromHeap(&market.OrderBook.NoBids.OrderHeap); foundOrder != nil {
		refund = foundOrder.Price * float64(foundOrder.Quantity-foundOrder.Filled)
		refundType = "INR"
	} else if foundOrder = removeFromHeap(&market.OrderBook.YesAsks.OrderHeap); foundOrder != nil {
		refund = float64(foundOrder.Quantity - foundOrder.Filled)
		refundType = "YES_STOCK"
	} else if foundOrder = removeFromHeap(&market.OrderBook.NoAsks.OrderHeap); foundOrder != nil {
		refund = float64(foundOrder.Quantity - foundOrder.Filled)
		refundType = "NO_STOCK"
	}

	if foundOrder == nil {
		msg.ReplyChan <- types.OrderResponse{Success: false, Message: "order not found"}
		return
	}

	e.UM.Lock()
	if refundType == "INR" {
		e.User[req.UserId].Balance.WalletBalance.Locked -= refund
		e.User[req.UserId].Balance.WalletBalance.Amount += refund
	} else {
		stock := e.User[req.UserId].Balance.StockBalance[req.Symbol]
		if refundType == "YES_STOCK" {
			stock.Yes += int(refund)
		} else {
			stock.No += int(refund)
		}
		e.User[req.UserId].Balance.StockBalance[req.Symbol] = stock
	}
	e.UM.Unlock()

	kafka.ProduceEventToDBProcessor("process_db", "ORDER_CANCELLED", map[string]interface{}{
		"userId": req.UserId, "orderId": req.OrderId, "refund": refund, "type": refundType, "marketId": req.MarketId,
	})

	aggOrderBook := utils.AggregateOrderBook(market.OrderBook)
	probability := utils.GetYesProbability(aggOrderBook)
	yesPrice := math.Round(probability*10*2) / 2
	noPrice := math.Round((1-probability)*10*2) / 2

	if yesPrice != float64(market.YesPrice) || noPrice != float64(market.NoPrice) {
		market.YesPrice = float32(yesPrice)
		market.NoPrice = float32(noPrice)
		kafka.ProduceEventToDBProcessor("process_db", "UPDATE_STOCK_PRICE", map[string]interface{}{
			"marketId": req.MarketId, "yesPrice": yesPrice, "noPrice": noPrice,
		})
	}

	// Broadcast TICKER update (lightweight)
	tickerPayload := map[string]interface{}{
		"type":            "TICKER",
		"symbol":          req.Symbol,
		"yesPrice":        yesPrice,
		"noPrice":         noPrice,
		"volume":          market.Volume,
		"numberOfTraders": market.NumberOfTraders,
	}
	if tickerData, err := json.Marshal(tickerPayload); err == nil {
		e.BroadcastMessage("stream:data", string(tickerData))
	}

	// Broadcast ORDERBOOK update
	orderbookPayload := map[string]interface{}{
		"type":      "ORDERBOOK",
		"symbol":    req.Symbol,
		"orderbook": aggOrderBook,
	}
	if obData, err := json.Marshal(orderbookPayload); err == nil {
		e.BroadcastMessage("stream:data", string(obData))
	}

	log.Info().Str("orderId", req.OrderId).Msg("Order cancelled successfully")
	msg.ReplyChan <- types.OrderResponse{Success: true, Message: "order cancelled"}
}
