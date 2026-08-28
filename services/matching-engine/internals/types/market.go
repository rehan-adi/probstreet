package types

import (
	"sync"
	"time"
)

type MarketMessageType string

const (
	MarketPlaceOrder    MarketMessageType = "PLACE_ORDER"
	MarketSellOrder     MarketMessageType = "SELL_ORDER"
	MarketCancelOrder   MarketMessageType = "CANCEL_ORDER"
	MarketGetOrderBook  MarketMessageType = "GET_ORDERBOOK"
	MarketResolveMarket MarketMessageType = "RESOLVE_MARKET"
)

type MarketMessage struct {
	Type      MarketMessageType
	Payload   interface{}
	ReplyChan chan interface{}
}

type Market struct {
	MarketId        string
	Title           string
	Symbol          string
	YesPrice        float32
	NoPrice         float32
	Thumbnail       string
	CategoryId      string
	NumberOfTraders int16
	Traders         map[string]struct{}
	Volume          float64
	Status          MarketStatus
	OrderBook       *OrderBook

	Overview Overview
	Trades   []TradeExecutedEvent
	Inbox    chan MarketMessage
	Mu       sync.RWMutex
	PreviousOrderBook AggregatedOrderBook
}

type MarketStatus string

const (
	Open  MarketStatus = "open"
	Close MarketStatus = "close"
)

type Overview struct {
	StartDate     time.Time
	EndDate       time.Time
	SourceOfTruth string
	Rules         string
	EOS           string
}
