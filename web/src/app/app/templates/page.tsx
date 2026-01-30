import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { PlusIcon, FileTextIcon } from "lucide-react"

export default function TemplatesPage() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Templates</h1>
          <p className="text-muted-foreground">Email templates for your campaigns.</p>
        </div>
        <Button>
          <PlusIcon className="mr-2 h-4 w-4" />
          New Template
        </Button>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        <Card className="border-dashed">
          <CardHeader className="flex flex-col items-center justify-center space-y-2 py-8">
            <FileTextIcon className="h-8 w-8 text-muted-foreground" />
            <CardTitle className="text-sm font-medium">No templates yet</CardTitle>
            <CardDescription className="text-center">
              Create your first template to speed up your workflow.
            </CardDescription>
            <Button variant="secondary" size="sm" className="mt-2">
              <PlusIcon className="mr-2 h-4 w-4" />
              Create Template
            </Button>
          </CardHeader>
        </Card>
      </div>
    </div>
  )
}
