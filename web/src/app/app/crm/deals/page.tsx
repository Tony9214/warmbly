import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { PlusIcon, CircleDollarSignIcon } from "lucide-react"

export default function DealsPage() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Deals</h1>
          <p className="text-muted-foreground">Track and manage your deals.</p>
        </div>
        <Button>
          <PlusIcon className="mr-2 h-4 w-4" />
          New Deal
        </Button>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        <Card className="border-dashed">
          <CardHeader className="flex flex-col items-center justify-center space-y-2 py-8">
            <CircleDollarSignIcon className="h-8 w-8 text-muted-foreground" />
            <CardTitle className="text-sm font-medium">No deals yet</CardTitle>
            <CardDescription className="text-center">
              Create your first deal to start tracking opportunities.
            </CardDescription>
            <Button variant="secondary" size="sm" className="mt-2">
              <PlusIcon className="mr-2 h-4 w-4" />
              Create Deal
            </Button>
          </CardHeader>
        </Card>
      </div>
    </div>
  )
}
