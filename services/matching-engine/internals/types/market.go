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
	MarketId        string              `json:"marketId"`
	Title           string              `json:"title"`
	Symbol          string              `json:"symbol"`
	YesPrice        float32             `json:"yesPrice"`
	NoPrice         float32             `json:"noPrice"`
	Thumbnail       string              `json:"thumbnail"`
	CategoryId      string              `json:"categoryId"`
	NumberOfTraders int16               `json:"numberOfTraders"`
	Traders         map[string]struct{} `json:"-"`
	Volume          float64             `json:"volume"`
	Status          MarketStatus        `json:"status"`
	OrderBook       *OrderBook          `json:"-"`

	Overview          Overview            `json:"overview"`
	Trades            []TradeExecutedEvent `json:"trades"`
	Inbox             chan MarketMessage  `json:"-"`
	Mu                sync.RWMutex        `json:"-"`
	PreviousOrderBook AggregatedOrderBook `json:"-"`
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
