package encryptedkeys

import (
	"context"
	"errors"
	"fmt"

	"github.com/aws/aws-sdk-go-v2/aws"
	"github.com/aws/aws-sdk-go-v2/feature/dynamodb/attributevalue"
	"github.com/aws/aws-sdk-go-v2/service/dynamodb"
	"github.com/aws/aws-sdk-go-v2/service/dynamodb/types"
	"github.com/google/uuid"
	"github.com/warmbly/warmbly/internal/infrastructure/dynamo"
)

// DefaultDynamoTable is the table name used when none is configured.
const DefaultDynamoTable = "UserEncryptedKeys"

// DynamoStore stores encrypted DEKs in a DynamoDB-API-compatible table.
// Works against AWS DynamoDB and self-hosted ScyllaDB Alternator
// (set AWS_ENDPOINT_URL_DYNAMODB to point at Scylla).
type DynamoStore struct {
	db    *dynamo.Client
	table string
}

func NewDynamo(c *dynamo.Client, table string) *DynamoStore {
	if table == "" {
		table = DefaultDynamoTable
	}
	return &DynamoStore{db: c, table: table}
}

func (s *DynamoStore) Name() string { return "dynamodb" }

type dynamoItem struct {
	UserID           string `dynamodbav:"userId"`
	EncryptedDataKey string `dynamodbav:"encryptedDataKey"`
}

func (s *DynamoStore) Put(ctx context.Context, userID uuid.UUID, encryptedDEKB64 string) error {
	body, err := attributevalue.MarshalMap(dynamoItem{
		UserID:           userID.String(),
		EncryptedDataKey: encryptedDEKB64,
	})
	if err != nil {
		return fmt.Errorf("encryptedkeys.dynamo: marshal: %w", err)
	}
	_, err = s.db.PutItem(ctx, &dynamodb.PutItemInput{
		TableName:           aws.String(s.table),
		Item:                body,
		ConditionExpression: aws.String("attribute_not_exists(userId)"),
	})
	if err != nil {
		var ccfe *types.ConditionalCheckFailedException
		if errors.As(err, &ccfe) {
			return ErrAlreadyExists
		}
		return fmt.Errorf("encryptedkeys.dynamo: put: %w", err)
	}
	return nil
}

func (s *DynamoStore) Get(ctx context.Context, userID uuid.UUID) (string, error) {
	resp, err := s.db.GetItem(ctx, &dynamodb.GetItemInput{
		TableName: aws.String(s.table),
		Key: map[string]types.AttributeValue{
			"userId": &types.AttributeValueMemberS{Value: userID.String()},
		},
	})
	if err != nil {
		return "", fmt.Errorf("encryptedkeys.dynamo: get: %w", err)
	}
	if len(resp.Item) == 0 {
		return "", nil
	}
	var item dynamoItem
	if err := attributevalue.UnmarshalMap(resp.Item, &item); err != nil {
		return "", fmt.Errorf("encryptedkeys.dynamo: unmarshal: %w", err)
	}
	return item.EncryptedDataKey, nil
}

func (s *DynamoStore) Delete(ctx context.Context, userID uuid.UUID) error {
	_, err := s.db.DeleteItem(ctx, &dynamodb.DeleteItemInput{
		TableName: aws.String(s.table),
		Key: map[string]types.AttributeValue{
			"userId": &types.AttributeValueMemberS{Value: userID.String()},
		},
	})
	if err != nil {
		return fmt.Errorf("encryptedkeys.dynamo: delete: %w", err)
	}
	return nil
}
