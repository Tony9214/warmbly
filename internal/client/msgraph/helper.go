package msgraph

import (
	"fmt"
	"strings"
)

// GetAddress renders the mailbox's RFC 5322 From value ("First Last <email>").
func (c *Client) GetAddress() string {
	return fmt.Sprintf("%s <%s>", strings.TrimSpace(c.FirstName+" "+c.LastName), c.Email)
}
