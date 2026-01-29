package config

import (
	"context"

	"github.com/warmbly/warmbly/internal/infrastructure/kafka"
)

func (c *Config) LoadKafkaBootstrapServers(ctx context.Context) (string, error) {
	kafkaBootstrapServers, err := c.params.Get(ctx, "kafka/bootstrap_servers")
	if err != nil {
		return "", err
	}

	return kafkaBootstrapServers, nil
}

func (c *Config) LoadKafkaConfigSasl(ctx context.Context) (*kafka.SASLConfig, error) {
	kafkaSaslUsername, err := c.secrets.Get(ctx, "kafka/sasl/username")
	if err != nil {
		return nil, err
	}

	kafkaSaslPassword, err := c.secrets.Get(ctx, "kafka/sasl/password")
	if err != nil {
		return nil, err
	}

	return &kafka.SASLConfig{
		Username: kafkaSaslUsername,
		Password: kafkaSaslPassword,
	}, nil
}

func (c *Config) LoadSchemaRegistryConfig(ctx context.Context) (endpoint, key, secret string, err error) {
	endpoint, err = c.params.Get(ctx, "kafka/schema_registry/endpoint")
	if err != nil {
		return "", "", "", err
	}

	key, err = c.secrets.Get(ctx, "kafka/schema_registry/key")
	if err != nil {
		return "", "", "", err
	}

	secret, err = c.secrets.Get(ctx, "kafka/schema_registry/secret")
	if err != nil {
		return "", "", "", err
	}

	return endpoint, key, secret, nil
}

// TrackingConsumerConfig holds configuration for the tracking events consumer
type TrackingConsumerConfig struct {
	Brokers      string
	Topic        string
	GroupID      string
	SASLEnabled  bool
	SASLUsername string
	SASLPassword string
}

// LoadTrackingConsumerConfig loads configuration for the tracking events consumer
func (c *Config) LoadTrackingConsumerConfig(ctx context.Context) (*TrackingConsumerConfig, error) {
	brokers, err := c.params.Get(ctx, "kafka/bootstrap_servers")
	if err != nil {
		return nil, err
	}

	// Default topic and group ID, can be overridden via params
	topic := "tracking-events"
	if t, err := c.params.Get(ctx, "kafka/tracking/topic"); err == nil && t != "" {
		topic = t
	}

	groupID := "tracking-consumer"
	if g, err := c.params.Get(ctx, "kafka/tracking/group_id"); err == nil && g != "" {
		groupID = g
	}

	// Load SASL credentials from secrets manager
	saslUsername, err := c.secrets.Get(ctx, "kafka/sasl/username")
	if err != nil {
		// SASL might be disabled in dev
		return &TrackingConsumerConfig{
			Brokers:     brokers,
			Topic:       topic,
			GroupID:     groupID,
			SASLEnabled: false,
		}, nil
	}

	saslPassword, err := c.secrets.Get(ctx, "kafka/sasl/password")
	if err != nil {
		return nil, err
	}

	return &TrackingConsumerConfig{
		Brokers:      brokers,
		Topic:        topic,
		GroupID:      groupID,
		SASLEnabled:  true,
		SASLUsername: saslUsername,
		SASLPassword: saslPassword,
	}, nil
}
