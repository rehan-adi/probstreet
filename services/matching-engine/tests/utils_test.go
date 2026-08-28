package tests

import (
	"math"
	"testing"
	"time"

	"matching-engine/internals/types"
	"matching-engine/internals/utils"
)

func TestProbabilityAndOrderBookUtils(t *testing.T) {
	emptyBook := types.AggregatedOrderBook{
		Yes: []types.PriceQuantity{},
		No:  []types.PriceQuantity{},
	}
	prob := utils.GetYesProbability(emptyBook)
	if prob != 0.5 {
		t.Errorf("Expected 0.5 probability for empty book, got %.2f", prob)
	}

	skewedBook := types.AggregatedOrderBook{
		Yes: []types.PriceQuantity{
			{Price: 7.0, Quantity: 10},
		},
		No: []types.PriceQuantity{
			{Price: 3.0, Quantity: 10},
		},
	}
	skewedProb := utils.GetYesProbability(skewedBook)
	expectedProb := 70.0 / (70.0 + 30.0)
	if math.Abs(skewedProb-expectedProb) > 1e-6 {
		t.Errorf("Expected probability 0.70, got %.4f", skewedProb)
	}

	ob := &types.OrderBook{
		YesBids: &types.BidHeap{OrderHeap: types.OrderHeap{
			&types.Order{Price: 5.0, Quantity: 10, Filled: 0, Timestamp: time.Now()},
			&types.Order{Price: 5.0, Quantity: 15, Filled: 5, Timestamp: time.Now()},
			&types.Order{Price: 6.0, Quantity: 20, Filled: 0, Timestamp: time.Now()},
		}},
		YesAsks: &types.AskHeap{OrderHeap: types.OrderHeap{}},
		NoBids:  &types.BidHeap{OrderHeap: types.OrderHeap{}},
		NoAsks:  &types.AskHeap{OrderHeap: types.OrderHeap{}},
	}

	agg := utils.AggregateOrderBook(ob)
	if len(agg.Yes) != 2 {
		t.Fatalf("Expected 2 price levels in aggregate book, got %d", len(agg.Yes))
	}
	if agg.Yes[0].Price != 6.0 || agg.Yes[0].Quantity != 20 {
		t.Errorf("Expected top level to be 6.0 @ 20, got: %+v", agg.Yes[0])
	}
	if agg.Yes[1].Price != 5.0 || agg.Yes[1].Quantity != 20 {
		t.Errorf("Expected second level to be 5.0 @ 20, got: %+v", agg.Yes[1])
	}

	oldBook := agg
	newBook := types.AggregatedOrderBook{
		Yes: []types.PriceQuantity{
			{Price: 6.0, Quantity: 15},
		},
		No: []types.PriceQuantity{},
	}
	diff := utils.CalculateOrderBookDiff(oldBook, newBook)
	if len(diff.Yes) != 2 {
		t.Fatalf("Expected 2 entries in diff, got %d", len(diff.Yes))
	}
}

func TestGenerateOrderID(t *testing.T) {
	id1 := utils.GenerateOrderID()
	id2 := utils.GenerateOrderID()
	if id1 == "" || id2 == "" {
		t.Fatalf("Generated order ID cannot be empty")
	}
	if id1 == id2 {
		t.Fatalf("Expected unique order IDs, got identical: %s", id1)
	}
}
