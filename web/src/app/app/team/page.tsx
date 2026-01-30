import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { PlusIcon, UsersIcon } from "lucide-react"

export default function TeamPage() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Team</h1>
          <p className="text-muted-foreground">Manage your team members and invitations.</p>
        </div>
        <Button>
          <PlusIcon className="mr-2 h-4 w-4" />
          Invite Member
        </Button>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        <Card className="border-dashed">
          <CardHeader className="flex flex-col items-center justify-center space-y-2 py-8">
            <UsersIcon className="h-8 w-8 text-muted-foreground" />
            <CardTitle className="text-sm font-medium">No team members yet</CardTitle>
            <CardDescription className="text-center">
              Invite team members to collaborate.
            </CardDescription>
            <Button variant="secondary" size="sm" className="mt-2">
              <PlusIcon className="mr-2 h-4 w-4" />
              Invite Member
            </Button>
          </CardHeader>
        </Card>
      </div>
    </div>
  )
}
