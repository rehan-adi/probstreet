package engine

import (
	"context"

	"github.com/rs/zerolog/log"
)

func (e *Engine) BroadcastMessage(channel string, message string) {
	if e.Redis == nil {
		return
	}

	err := e.Redis.Publish(context.Background(), channel, message).Err()

	if err != nil {
		log.Error().Err(err).Msg("failed to broadcast message to stream service")
	}

}
