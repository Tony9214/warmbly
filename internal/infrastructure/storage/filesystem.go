package storage

import (
	"context"
	"errors"
	"fmt"
	"io"
	"os"
	"path/filepath"
	"strings"
	"time"
)

// FilesystemStore is a Store backed by a local directory. Suitable for
// single-node self-hosted deployments. Not suitable for multi-node setups
// without shared storage (NFS, etc.).
//
// Object keys are translated to file paths under Root. Any ".." path component
// is rejected to prevent directory traversal.
type FilesystemStore struct {
	root string
}

// NewFilesystem returns a FilesystemStore rooted at the given directory. The
// directory is created (recursively) if it doesn't exist.
func NewFilesystem(root string) (*FilesystemStore, error) {
	if root == "" {
		return nil, errors.New("filesystem store: root is required")
	}
	abs, err := filepath.Abs(root)
	if err != nil {
		return nil, fmt.Errorf("filesystem store: abs path: %w", err)
	}
	if err := os.MkdirAll(abs, 0o755); err != nil {
		return nil, fmt.Errorf("filesystem store: mkdir: %w", err)
	}
	return &FilesystemStore{root: abs}, nil
}

func (s *FilesystemStore) Name() string { return "filesystem" }

func (s *FilesystemStore) resolve(key string) (string, error) {
	if key == "" {
		return "", errors.New("filesystem store: empty key")
	}
	// Reject '..' as a literal path component before normalization — otherwise
	// "a/../b" silently maps to "b" and collides with the literal key "b".
	for _, p := range strings.Split(key, "/") {
		if p == ".." {
			return "", errors.New("filesystem store: '..' not allowed in key")
		}
	}
	clean := filepath.Clean("/" + key)
	return filepath.Join(s.root, clean), nil
}

func (s *FilesystemStore) Get(_ context.Context, key string) (io.ReadCloser, error) {
	path, err := s.resolve(key)
	if err != nil {
		return nil, err
	}
	f, err := os.Open(path)
	if err != nil {
		if errors.Is(err, os.ErrNotExist) {
			return nil, ErrNotFound
		}
		return nil, err
	}
	return f, nil
}

// Put writes atomically: stream to a temp file, fsync, then rename. Crashes
// mid-write leave the destination unchanged.
func (s *FilesystemStore) Put(_ context.Context, key string, body io.Reader, _ string) error {
	path, err := s.resolve(key)
	if err != nil {
		return err
	}
	if err := os.MkdirAll(filepath.Dir(path), 0o755); err != nil {
		return err
	}
	tmp, err := os.CreateTemp(filepath.Dir(path), ".put-*")
	if err != nil {
		return err
	}
	tmpName := tmp.Name()
	defer os.Remove(tmpName) // no-op once rename succeeds

	if _, err := io.Copy(tmp, body); err != nil {
		tmp.Close()
		return err
	}
	if err := tmp.Sync(); err != nil {
		tmp.Close()
		return err
	}
	if err := tmp.Close(); err != nil {
		return err
	}
	return os.Rename(tmpName, path)
}

func (s *FilesystemStore) Delete(_ context.Context, key string) error {
	path, err := s.resolve(key)
	if err != nil {
		return err
	}
	if err := os.Remove(path); err != nil && !errors.Is(err, os.ErrNotExist) {
		return err
	}
	return nil
}

func (s *FilesystemStore) Has(_ context.Context, key string) (bool, error) {
	path, err := s.resolve(key)
	if err != nil {
		return false, err
	}
	_, err = os.Stat(path)
	switch {
	case err == nil:
		return true, nil
	case errors.Is(err, os.ErrNotExist):
		return false, nil
	default:
		return false, err
	}
}

// PresignedGetURL is not supported by the filesystem backend — there's no
// authority to sign URLs against. Callers should fall back to streaming the
// object through the application.
func (s *FilesystemStore) PresignedGetURL(_ context.Context, _ string, _ time.Duration) (string, error) {
	return "", ErrUnsupported
}
