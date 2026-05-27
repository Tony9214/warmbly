package storage

import (
	"context"
	"errors"
	"io"
	"time"

	"github.com/aws/aws-sdk-go-v2/aws"
	"github.com/aws/aws-sdk-go-v2/service/s3"
	"github.com/aws/aws-sdk-go-v2/service/s3/types"
)

// High-level Store methods on *Client. These let callers depend on the
// storage.Store interface so the same code works against AWS S3, MinIO,
// Cloudflare R2, Backblaze B2, Hetzner Object Storage, or the filesystem
// backend without conditional logic.
//
// The lower-level Client.GetObject / PutObject / etc. (via embedded *s3.Client)
// remain available for existing call sites that haven't been migrated yet.

func (c *Client) Name() string { return "s3" }

func (c *Client) Get(ctx context.Context, key string) (io.ReadCloser, error) {
	out, err := c.GetObject(ctx, &s3.GetObjectInput{
		Bucket: aws.String(c.Bucket),
		Key:    aws.String(key),
	})
	if err != nil {
		var nsk *types.NoSuchKey
		if errors.As(err, &nsk) {
			return nil, ErrNotFound
		}
		return nil, err
	}
	return out.Body, nil
}

func (c *Client) Put(ctx context.Context, key string, body io.Reader, contentType string) error {
	in := &s3.PutObjectInput{
		Bucket: aws.String(c.Bucket),
		Key:    aws.String(key),
		Body:   body,
	}
	if contentType != "" {
		in.ContentType = aws.String(contentType)
	}
	_, err := c.PutObject(ctx, in)
	return err
}

func (c *Client) Delete(ctx context.Context, key string) error {
	_, err := c.DeleteObject(ctx, &s3.DeleteObjectInput{
		Bucket: aws.String(c.Bucket),
		Key:    aws.String(key),
	})
	return err
}

func (c *Client) Has(ctx context.Context, key string) (bool, error) {
	return c.Exists(ctx, c.Bucket, key)
}

func (c *Client) PresignedGetURL(ctx context.Context, key string, ttl time.Duration) (string, error) {
	ps := s3.NewPresignClient(c.Client)
	out, err := ps.PresignGetObject(ctx, &s3.GetObjectInput{
		Bucket: aws.String(c.Bucket),
		Key:    aws.String(key),
	}, s3.WithPresignExpires(ttl))
	if err != nil {
		return "", err
	}
	return out.URL, nil
}
