package middleware

import (
	"strconv"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/warmbly/warmbly/internal/infrastructure/metrics"
)

// MetricsMiddleware records request duration and counts for Prometheus
func MetricsMiddleware() gin.HandlerFunc {
	return func(c *gin.Context) {
		start := time.Now()

		c.Next()

		duration := time.Since(start).Seconds()
		status := strconv.Itoa(c.Writer.Status())
		path := c.FullPath()
		if path == "" {
			path = "unknown"
		}

		metrics.APIRequestDuration.WithLabelValues(c.Request.Method, path, status).Observe(duration)
		metrics.APIRequestsTotal.WithLabelValues(c.Request.Method, path, status).Inc()
	}
}
