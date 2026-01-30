import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { PlusIcon, KeyIcon } from "lucide-react"

export default function APIKeysPage() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">API Keys</h1>
          <p className="text-muted-foreground">Manage your API keys for integrations.</p>
        </div>
        <Button>
          <PlusIcon className="mr-2 h-4 w-4" />
          Create API Key
        </Button>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        <Card className="border-dashed">
          <CardHeader className="flex flex-col items-center justify-center space-y-2 py-8">
            <KeyIcon className="h-8 w-8 text-muted-foreground" />
            <CardTitle className="text-sm font-medium">No API keys yet</CardTitle>
            <CardDescription className="text-center">
              Create an API key to integrate with external services.
            </CardDescription>
            <Button variant="secondary" size="sm" className="mt-2">
              <PlusIcon className="mr-2 h-4 w-4" />
              Create API Key
            </Button>
          </CardHeader>
        </Card>
      </div>
    </div>
  )
}
