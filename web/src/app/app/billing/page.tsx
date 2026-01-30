import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { CreditCardIcon } from "lucide-react"

export default function BillingPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Billing</h1>
        <p className="text-muted-foreground">Manage your subscription and payment methods.</p>
      </div>

      <div className="grid gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Current Plan</CardTitle>
            <CardDescription>You are currently on the Free plan.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center gap-4">
              <CreditCardIcon className="h-8 w-8 text-muted-foreground" />
              <div>
                <p className="font-medium">Free Plan</p>
                <p className="text-sm text-muted-foreground">Basic features for getting started</p>
              </div>
            </div>
            <Button>Upgrade Plan</Button>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
