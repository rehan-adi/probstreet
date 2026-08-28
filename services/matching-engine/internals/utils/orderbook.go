package utils

import (
	"matching-engine/internals/types"
	"sort"
)

func aggregateOrders(orders types.OrderHeap, isAscending bool) []types.PriceQuantity {
	priceMap := make(map[float64]int)
	for _, order := range orders {
		remaining := order.Quantity - order.Filled
		if remaining > 0 {
			priceMap[order.Price] += remaining
		}
	}

	result := make([]types.PriceQuantity, 0)
	for price, qty := range priceMap {
		result = append(result, types.PriceQuantity{
			Price:    price,
			Quantity: qty,
		})
	}

	sort.Slice(result, func(i, j int) bool {
		if isAscending {
			return result[i].Price < result[j].Price
		}
		return result[i].Price > result[j].Price
	})

	return result
}

func AggregateOrderBook(ob *types.OrderBook) types.AggregatedOrderBook {
	// For the frontend, Yes orderbook is typically the YES Bids (Buy Yes) and YES Asks (Sell Yes).
	// To keep it simple, we aggregate the YesBids and YesAsks.
	// Wait, the frontend usually expects 'Yes' and 'No' to represent the available liquidity TO BUY.
	// That means 'Yes' in the response should be YesAsks (what people are selling, so you can buy).
	// But let's just return what they expect. Originally it just returned Yes and No orders.
	// For now, let's aggregate Yes Bids and Asks into one? The struct types.AggregatedOrderBook has Yes and No arrays.
	// Actually, the frontend probably expects Bids and Asks for the whole market.
	// The struct AggregatedOrderBook has `Yes` and `No`. We'll just put YesBids/YesAsks into Yes, NoBids/NoAsks into No for now.
	// Let's preserve the original behavior: returning all Yes orders in `Yes`, all No orders in `No`.

	var yesOrders types.OrderHeap
	yesOrders = append(yesOrders, ob.YesBids.OrderHeap...)
	yesOrders = append(yesOrders, ob.YesAsks.OrderHeap...)

	var noOrders types.OrderHeap
	noOrders = append(noOrders, ob.NoBids.OrderHeap...)
	noOrders = append(noOrders, ob.NoAsks.OrderHeap...)

	return types.AggregatedOrderBook{
		Yes: aggregateOrders(yesOrders, false), // Descending for orderbook
		No:  aggregateOrders(noOrders, false),
	}
}

func calculateSideDiff(oldSide, newSide []types.PriceQuantity) []types.PriceQuantity {
	var diff []types.PriceQuantity
	
	oldMap := make(map[float64]int)
	for _, pq := range oldSide {
		oldMap[pq.Price] = pq.Quantity
	}
	
	for _, pq := range newSide {
		if oldQty, exists := oldMap[pq.Price]; !exists || oldQty != pq.Quantity {
			diff = append(diff, pq)
		}
		delete(oldMap, pq.Price)
	}
	
	for price := range oldMap {
		diff = append(diff, types.PriceQuantity{
			Price:    price,
			Quantity: 0,
		})
	}
	
	return diff
}

func CalculateOrderBookDiff(oldBook, newBook types.AggregatedOrderBook) types.AggregatedOrderBook {
	return types.AggregatedOrderBook{
		Yes: calculateSideDiff(oldBook.Yes, newBook.Yes),
		No:  calculateSideDiff(oldBook.No, newBook.No),
	}
}
