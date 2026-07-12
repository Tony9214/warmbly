// Settings → Worker Profiles.
//
// A worker profile is the runtime config template (image, Kafka, Redis,
// schema registry, AWS creds) pushed to worker machines. Operators edit
// the profile here, then apply it to re-write worker.env on every
// assigned machine and restart the service. Secrets are write-only and
// shown only as set / not set indicators.

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
    Boxes,
    CheckCircle2,
    MinusCircle,
    Pencil,
    Plus,
    Rocket,
    Server,
    Trash2,
    UploadCloud,
    XCircle,
} from "lucide-react";

import { PageHeader } from "@/components/layout/PageHeader";
import { ErrorState } from "@/components/ErrorState";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from "@/components/ui/card";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import {
    applyWorkerProfile,
    createWorkerProfile,
    deleteWorkerProfile,
    listWorkerProfiles,
    listWorkerProfileWorkers,
    setWorkerProfileRelease,
    updateWorkerProfile,
} from "@/lib/api/client/admin/workerProfiles";
import type {
    WorkerProfile,
    WorkerProfileApplyResult,
    WorkerProfileBody,
    WorkerProfileReleaseChannel,
} from "@/lib/api/client/admin/workerProfiles";

const CHANNEL_BADGE: Record<WorkerProfileReleaseChannel, string> = {
    pinned: "bg-zinc-100 text-zinc-700 border-zinc-200",
    stable: "bg-emerald-100 text-emerald-700 border-emerald-200",
    dev: "bg-amber-100 text-amber-700 border-amber-200",
};

const CHANNEL_HINT: Record<WorkerProfileReleaseChannel, string> = {
    pinned: "The image tag is fixed until you change it.",
    stable: "Follows tagged releases.",
    dev: "Follows pre-releases.",
};

export default function WorkerProfilesPage() {
    const qc = useQueryClient();
    const profilesQ = useQuery({
        queryKey: ["admin", "worker-profiles"],
        queryFn: listWorkerProfiles,
        retry: false,
    });

    const invalidate = () =>
        qc.invalidateQueries({ queryKey: ["admin", "worker-profiles"] });

    return (
        <div>
            <PageHeader
                title="Worker Profiles"
                description="A profile is the runtime config template (image, Kafka, Redis, schema registry, AWS creds) pushed to worker machines. Edit it here, then apply it to roll the change out."
            >
                <ProfileFormDialog onSaved={invalidate} />
            </PageHeader>

            {profilesQ.isLoading && (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
                    <Skeleton className="h-52 w-full" />
                    <Skeleton className="h-52 w-full" />
                </div>
            )}

            {profilesQ.isError && (
                <ErrorState
                    error={profilesQ.error}
                    title="Couldn’t load worker profiles"
                    onRetry={() => profilesQ.refetch()}
                />
            )}

            {profilesQ.data && profilesQ.data.length === 0 && (
                <Card>
                    <CardContent className="py-12 text-center">
                        <Boxes className="size-8 text-muted-foreground mx-auto mb-3" />
                        <div className="text-sm font-medium">No worker profiles yet</div>
                        <p className="text-xs text-muted-foreground mt-1 max-w-md mx-auto">
                            Create a profile with the image, Kafka, Redis, schema registry,
                            and AWS settings your workers should run with. You can then
                            assign it to machines and apply it in one click.
                        </p>
                        <div className="mt-4 flex justify-center">
                            <ProfileFormDialog onSaved={invalidate} />
                        </div>
                    </CardContent>
                </Card>
            )}

            {profilesQ.data && profilesQ.data.length > 0 && (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
                    {profilesQ.data.map((p) => (
                        <ProfileCard key={p.id} profile={p} onChanged={invalidate} />
                    ))}
                </div>
            )}
        </div>
    );
}

// --------------------------------------------------------------------
// Profile card
// --------------------------------------------------------------------

function ProfileCard({
    profile,
    onChanged,
}: {
    profile: WorkerProfile;
    onChanged: () => void;
}) {
    return (
        <Card>
            <CardHeader>
                <CardTitle className="flex items-center gap-2">
                    <Boxes className="size-4 text-[var(--admin-accent)]" />
                    <span className="truncate">{profile.name}</span>
                    <Badge
                        variant="outline"
                        className={`text-[10px] ${CHANNEL_BADGE[profile.release_channel]}`}
                    >
                        {profile.release_channel}
                    </Badge>
                    {profile.auto_update && (
                        <Badge
                            variant="outline"
                            className="text-[10px] bg-sky-100 text-sky-700 border-sky-200"
                        >
                            auto-update
                        </Badge>
                    )}
                </CardTitle>
                {profile.description && (
                    <CardDescription>{profile.description}</CardDescription>
                )}
            </CardHeader>
            <CardContent className="pt-0 space-y-3">
                <div className="text-[11px] text-muted-foreground">
                    <div className="uppercase tracking-wide text-[9px]">Image</div>
                    <div className="font-mono text-[11px] text-foreground break-all">
                        {profile.worker_image || "not set"}
                        {profile.resolved_image_tag && (
                            <span className="text-muted-foreground">
                                {" "}
                                → {profile.resolved_image_tag}
                            </span>
                        )}
                    </div>
                </div>

                <div className="flex flex-wrap gap-x-4 gap-y-1">
                    <SecretIndicator
                        label="Kafka password"
                        set={profile.has_kafka_password}
                    />
                    <SecretIndicator
                        label="Schema secret"
                        set={profile.has_schema_secret}
                    />
                    <SecretIndicator label="Redis URL" set={profile.has_redis_url} />
                </div>

                <div className="text-[11px] text-muted-foreground">
                    Updated {new Date(profile.updated_at).toLocaleString()}
                </div>

                <div className="flex flex-wrap items-center gap-2 pt-1">
                    <ProfileFormDialog profile={profile} onSaved={onChanged} />
                    <ReleaseDialog profile={profile} onSaved={onChanged} />
                    <WorkersDialog profile={profile} />
                    <ApplyDialog profile={profile} />
                    <DeleteDialog profile={profile} onDeleted={onChanged} />
                </div>
            </CardContent>
        </Card>
    );
}

function SecretIndicator({ label, set }: { label: string; set: boolean }) {
    return (
        <span className="inline-flex items-center gap-1 text-[11px]">
            {set ? (
                <CheckCircle2 className="size-3 text-emerald-600" />
            ) : (
                <MinusCircle className="size-3 text-muted-foreground" />
            )}
            <span className="text-muted-foreground">{label}:</span>
            <span className={set ? "text-emerald-700" : "text-muted-foreground"}>
                {set ? "set" : "not set"}
            </span>
        </span>
    );
}

// --------------------------------------------------------------------
// Create / edit dialog
// --------------------------------------------------------------------

interface FormState {
    name: string;
    description: string;
    app_env: string;
    worker_image: string;
    kafka_bootstrap_servers: string;
    kafka_sasl_username: string;
    kafka_sasl_password: string;
    schema_registry_url: string;
    schema_registry_key: string;
    schema_registry_secret: string;
    redis_url: string;
    aws_credential_id: string;
}

function initialForm(profile?: WorkerProfile): FormState {
    return {
        name: profile?.name ?? "",
        description: profile?.description ?? "",
        app_env: profile?.app_env ?? "",
        worker_image: profile?.worker_image ?? "",
        kafka_bootstrap_servers: profile?.kafka_bootstrap_servers ?? "",
        kafka_sasl_username: profile?.kafka_sasl_username ?? "",
        kafka_sasl_password: "",
        schema_registry_url: profile?.schema_registry_url ?? "",
        schema_registry_key: profile?.schema_registry_key ?? "",
        schema_registry_secret: "",
        redis_url: "",
        aws_credential_id: profile?.aws_credential_id ?? "",
    };
}

function ProfileFormDialog({
    profile,
    onSaved,
}: {
    profile?: WorkerProfile;
    onSaved: () => void;
}) {
    const isEdit = !!profile;
    const [open, setOpen] = useState(false);
    const [form, setForm] = useState<FormState>(() => initialForm(profile));

    const set =
        (field: keyof FormState) => (e: React.ChangeEvent<HTMLInputElement>) =>
            setForm((f) => ({ ...f, [field]: e.target.value }));

    const mut = useMutation({
        mutationFn: async () => {
            const body: WorkerProfileBody = {
                name: form.name.trim(),
                description: form.description.trim(),
                app_env: form.app_env.trim(),
                worker_image: form.worker_image.trim(),
                kafka_bootstrap_servers: form.kafka_bootstrap_servers.trim(),
                kafka_sasl_username: form.kafka_sasl_username.trim(),
                kafka_sasl_password: form.kafka_sasl_password,
                schema_registry_url: form.schema_registry_url.trim(),
                schema_registry_key: form.schema_registry_key.trim(),
                schema_registry_secret: form.schema_registry_secret,
                redis_url: form.redis_url,
                aws_credential_id: form.aws_credential_id.trim() || null,
            };
            return isEdit
                ? updateWorkerProfile(profile.id, body)
                : createWorkerProfile(body);
        },
        onSuccess: () => {
            toast.success(isEdit ? "Profile updated" : "Profile created");
            setOpen(false);
            onSaved();
        },
        onError: (e: Error) => toast.error(e.message),
    });

    const handleOpenChange = (next: boolean) => {
        setOpen(next);
        if (next) setForm(initialForm(profile));
    };

    const secretPlaceholder = isEdit ? "leave blank to keep current" : "";

    return (
        <Dialog open={open} onOpenChange={handleOpenChange}>
            <DialogTrigger asChild>
                {isEdit ? (
                    <Button size="sm" variant="outline">
                        <Pencil className="size-4" />
                        Edit
                    </Button>
                ) : (
                    <Button
                        size="sm"
                        className="bg-[var(--admin-accent)] hover:bg-[var(--admin-accent-strong)] text-white"
                    >
                        <Plus className="size-4" />
                        New profile
                    </Button>
                )}
            </DialogTrigger>
            <DialogContent className="sm:max-w-lg max-h-[85vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle>
                        {isEdit ? `Edit ${profile.name}` : "New worker profile"}
                    </DialogTitle>
                    <DialogDescription>
                        {isEdit
                            ? "Changes are saved to the profile only. Use apply to push them to the assigned machines."
                            : "The runtime config a worker machine runs with. You can assign machines to it afterwards."}
                    </DialogDescription>
                </DialogHeader>

                <div className="space-y-4">
                    <FormSection label="General">
                        <Field id="wp-name" label="Name">
                            <Input
                                id="wp-name"
                                placeholder="e.g. premium-eu"
                                value={form.name}
                                onChange={set("name")}
                                autoComplete="off"
                            />
                        </Field>
                        <Field id="wp-desc" label="Description" hint="Optional, shown in the list.">
                            <Input
                                id="wp-desc"
                                placeholder="e.g. premium workers in Falkenstein"
                                value={form.description}
                                onChange={set("description")}
                                autoComplete="off"
                            />
                        </Field>
                        <Field id="wp-env" label="App env" hint="Value for APP_ENV, e.g. production.">
                            <Input
                                id="wp-env"
                                placeholder="production"
                                value={form.app_env}
                                onChange={set("app_env")}
                                autoComplete="off"
                            />
                        </Field>
                        <Field
                            id="wp-image"
                            label="Worker image"
                            hint="Container image the worker runs. The tag follows the release channel."
                        >
                            <Input
                                id="wp-image"
                                placeholder="ghcr.io/warmbly/worker"
                                value={form.worker_image}
                                onChange={set("worker_image")}
                                autoComplete="off"
                            />
                        </Field>
                    </FormSection>

                    <FormSection label="Kafka">
                        <Field id="wp-kafka-servers" label="Bootstrap servers">
                            <Input
                                id="wp-kafka-servers"
                                placeholder="broker-1:9092,broker-2:9092"
                                value={form.kafka_bootstrap_servers}
                                onChange={set("kafka_bootstrap_servers")}
                                autoComplete="off"
                            />
                        </Field>
                        <Field id="wp-kafka-user" label="SASL username">
                            <Input
                                id="wp-kafka-user"
                                value={form.kafka_sasl_username}
                                onChange={set("kafka_sasl_username")}
                                autoComplete="off"
                            />
                        </Field>
                        <Field
                            id="wp-kafka-pass"
                            label="SASL password"
                            secretSet={profile?.has_kafka_password}
                        >
                            <Input
                                id="wp-kafka-pass"
                                type="password"
                                placeholder={secretPlaceholder}
                                value={form.kafka_sasl_password}
                                onChange={set("kafka_sasl_password")}
                                autoComplete="off"
                            />
                        </Field>
                    </FormSection>

                    <FormSection label="Schema registry">
                        <Field id="wp-sr-url" label="URL">
                            <Input
                                id="wp-sr-url"
                                placeholder="https://schema-registry.example.com"
                                value={form.schema_registry_url}
                                onChange={set("schema_registry_url")}
                                autoComplete="off"
                            />
                        </Field>
                        <Field id="wp-sr-key" label="API key">
                            <Input
                                id="wp-sr-key"
                                value={form.schema_registry_key}
                                onChange={set("schema_registry_key")}
                                autoComplete="off"
                            />
                        </Field>
                        <Field
                            id="wp-sr-secret"
                            label="API secret"
                            secretSet={profile?.has_schema_secret}
                        >
                            <Input
                                id="wp-sr-secret"
                                type="password"
                                placeholder={secretPlaceholder}
                                value={form.schema_registry_secret}
                                onChange={set("schema_registry_secret")}
                                autoComplete="off"
                            />
                        </Field>
                    </FormSection>

                    <FormSection label="Redis">
                        <Field
                            id="wp-redis"
                            label="Redis URL"
                            hint="Full connection URL; treated as a secret because it can carry a password."
                            secretSet={profile?.has_redis_url}
                        >
                            <Input
                                id="wp-redis"
                                type="password"
                                placeholder={secretPlaceholder || "redis://user:pass@host:6379"}
                                value={form.redis_url}
                                onChange={set("redis_url")}
                                autoComplete="off"
                            />
                        </Field>
                    </FormSection>

                    <FormSection label="AWS">
                        <Field
                            id="wp-aws"
                            label="AWS credential ID"
                            hint="Optional. ID of a stored AWS credential used for KMS and S3. Leave empty for none."
                        >
                            <Input
                                id="wp-aws"
                                value={form.aws_credential_id}
                                onChange={set("aws_credential_id")}
                                autoComplete="off"
                            />
                        </Field>
                    </FormSection>
                </div>

                <DialogFooter>
                    <Button variant="outline" onClick={() => setOpen(false)}>
                        Cancel
                    </Button>
                    <Button
                        onClick={() => mut.mutate()}
                        disabled={form.name.trim().length === 0 || mut.isPending}
                        className="bg-[var(--admin-accent)] hover:bg-[var(--admin-accent-strong)] text-white"
                    >
                        {mut.isPending
                            ? "Saving..."
                            : isEdit
                              ? "Save changes"
                              : "Create profile"}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}

function FormSection({
    label,
    children,
}: {
    label: string;
    children: React.ReactNode;
}) {
    return (
        <div className="space-y-3">
            <div className="text-[10px] uppercase tracking-wide text-muted-foreground border-b border-border pb-1">
                {label}
            </div>
            {children}
        </div>
    );
}

function Field({
    id,
    label,
    hint,
    secretSet,
    children,
}: {
    id: string;
    label: string;
    hint?: string;
    secretSet?: boolean;
    children: React.ReactNode;
}) {
    return (
        <div className="space-y-1.5">
            <div className="flex items-center gap-2">
                <Label htmlFor={id}>{label}</Label>
                {secretSet != null && (
                    <Badge variant="outline" className="text-[10px]">
                        {secretSet ? "set" : "not set"}
                    </Badge>
                )}
            </div>
            {children}
            {hint && <p className="text-[11px] text-muted-foreground">{hint}</p>}
        </div>
    );
}

// --------------------------------------------------------------------
// Release channel dialog
// --------------------------------------------------------------------

function ReleaseDialog({
    profile,
    onSaved,
}: {
    profile: WorkerProfile;
    onSaved: () => void;
}) {
    const [open, setOpen] = useState(false);
    const [channel, setChannel] = useState<WorkerProfileReleaseChannel>(
        profile.release_channel,
    );
    const [autoUpdate, setAutoUpdate] = useState(profile.auto_update);

    const mut = useMutation({
        mutationFn: () =>
            setWorkerProfileRelease(profile.id, {
                channel,
                auto_update: autoUpdate,
            }),
        onSuccess: () => {
            toast.success("Release settings saved");
            setOpen(false);
            onSaved();
        },
        onError: (e: Error) => toast.error(e.message),
    });

    const handleOpenChange = (next: boolean) => {
        setOpen(next);
        if (next) {
            setChannel(profile.release_channel);
            setAutoUpdate(profile.auto_update);
        }
    };

    return (
        <Dialog open={open} onOpenChange={handleOpenChange}>
            <DialogTrigger asChild>
                <Button size="sm" variant="outline">
                    <Rocket className="size-4" />
                    Release
                </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-md">
                <DialogHeader>
                    <DialogTitle>Release channel</DialogTitle>
                    <DialogDescription>
                        Controls which image tag this profile resolves to.
                    </DialogDescription>
                </DialogHeader>

                <div className="space-y-4">
                    <div className="space-y-1.5">
                        <Label htmlFor="wp-channel">Channel</Label>
                        <Select
                            value={channel}
                            onValueChange={(v) =>
                                setChannel(v as WorkerProfileReleaseChannel)
                            }
                        >
                            <SelectTrigger id="wp-channel">
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="pinned">Pinned</SelectItem>
                                <SelectItem value="stable">Stable</SelectItem>
                                <SelectItem value="dev">Dev</SelectItem>
                            </SelectContent>
                        </Select>
                        <p className="text-[11px] text-muted-foreground">
                            {CHANNEL_HINT[channel]}
                        </p>
                    </div>

                    <div className="flex items-start justify-between gap-3">
                        <div>
                            <Label htmlFor="wp-auto-update">Auto-update</Label>
                            <p className="text-[11px] text-muted-foreground mt-0.5">
                                Rolls assigned workers automatically when a new image lands.
                            </p>
                        </div>
                        <Switch
                            id="wp-auto-update"
                            checked={autoUpdate}
                            onCheckedChange={setAutoUpdate}
                        />
                    </div>

                    {profile.resolved_image_tag && (
                        <div className="text-[11px] text-muted-foreground">
                            Currently resolved tag:{" "}
                            <span className="font-mono text-foreground">
                                {profile.resolved_image_tag}
                            </span>
                        </div>
                    )}
                </div>

                <DialogFooter>
                    <Button variant="outline" onClick={() => setOpen(false)}>
                        Cancel
                    </Button>
                    <Button
                        onClick={() => mut.mutate()}
                        disabled={mut.isPending}
                        className="bg-[var(--admin-accent)] hover:bg-[var(--admin-accent-strong)] text-white"
                    >
                        {mut.isPending ? "Saving..." : "Save"}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}

// --------------------------------------------------------------------
// Workers dialog
// --------------------------------------------------------------------

function WorkersDialog({ profile }: { profile: WorkerProfile }) {
    const [open, setOpen] = useState(false);

    const workersQ = useQuery({
        queryKey: ["admin", "worker-profiles", profile.id, "workers"],
        queryFn: () => listWorkerProfileWorkers(profile.id),
        enabled: open,
        retry: false,
    });

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
                <Button size="sm" variant="outline">
                    <Server className="size-4" />
                    Workers
                </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-md">
                <DialogHeader>
                    <DialogTitle>Workers using {profile.name}</DialogTitle>
                    <DialogDescription>
                        Machines this profile is assigned to. Applying the profile pushes
                        config to all of them.
                    </DialogDescription>
                </DialogHeader>

                {workersQ.isLoading && (
                    <div className="space-y-2">
                        <Skeleton className="h-9 w-full" />
                        <Skeleton className="h-9 w-full" />
                    </div>
                )}

                {workersQ.isError && (
                    <ErrorState
                        error={workersQ.error}
                        title="Couldn’t load workers"
                        onRetry={() => workersQ.refetch()}
                    />
                )}

                {workersQ.data && workersQ.data.length === 0 && (
                    <p className="text-sm text-muted-foreground py-2">
                        No workers use this profile yet.
                    </p>
                )}

                {workersQ.data && workersQ.data.length > 0 && (
                    <div className="divide-y divide-border rounded-md border border-border">
                        {workersQ.data.map((w) => (
                            <div
                                key={w.id}
                                className="flex items-center justify-between gap-2 px-3 py-2"
                            >
                                <div className="min-w-0">
                                    <div className="text-sm truncate">{w.name || w.id}</div>
                                    {w.name && (
                                        <div className="font-mono text-[10px] text-muted-foreground truncate">
                                            {w.id}
                                        </div>
                                    )}
                                </div>
                                {w.install_state && (
                                    <Badge variant="outline" className="text-[10px] shrink-0">
                                        {w.install_state}
                                    </Badge>
                                )}
                            </div>
                        ))}
                    </div>
                )}
            </DialogContent>
        </Dialog>
    );
}

// --------------------------------------------------------------------
// Apply dialog
// --------------------------------------------------------------------

function ApplyDialog({ profile }: { profile: WorkerProfile }) {
    const [open, setOpen] = useState(false);
    const [results, setResults] = useState<WorkerProfileApplyResult[] | null>(
        null,
    );

    const mut = useMutation({
        mutationFn: () => applyWorkerProfile(profile.id),
        onSuccess: (res) => {
            setResults(res);
            const failed = res.filter((r) => !r.ok && !r.skipped).length;
            if (failed === 0) {
                toast.success(
                    res.length === 0
                        ? "Nothing to apply: no workers use this profile"
                        : `Applied to ${res.length} worker${res.length === 1 ? "" : "s"}`,
                );
            } else {
                toast.error(`Apply finished with ${failed} failure${failed === 1 ? "" : "s"}`);
            }
        },
        onError: (e: Error) => toast.error(e.message),
    });

    const handleOpenChange = (next: boolean) => {
        setOpen(next);
        if (next) setResults(null);
    };

    return (
        <Dialog open={open} onOpenChange={handleOpenChange}>
            <DialogTrigger asChild>
                <Button size="sm" variant="outline">
                    <UploadCloud className="size-4" />
                    Apply
                </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-md">
                <DialogHeader>
                    <DialogTitle>Apply {profile.name} to workers</DialogTitle>
                    <DialogDescription>
                        Re-writes worker.env on every assigned machine and restarts the
                        worker service. In-flight work is drained by the restart, but
                        expect a brief pause in sending on those machines.
                    </DialogDescription>
                </DialogHeader>

                {results && (
                    <div className="divide-y divide-border rounded-md border border-border">
                        {results.length === 0 && (
                            <p className="text-sm text-muted-foreground px-3 py-2">
                                No workers use this profile.
                            </p>
                        )}
                        {results.map((r) => (
                            <div
                                key={r.worker_id}
                                className="flex items-start gap-2 px-3 py-2"
                            >
                                {r.ok ? (
                                    <CheckCircle2 className="size-3.5 mt-0.5 shrink-0 text-emerald-600" />
                                ) : r.skipped ? (
                                    <MinusCircle className="size-3.5 mt-0.5 shrink-0 text-muted-foreground" />
                                ) : (
                                    <XCircle className="size-3.5 mt-0.5 shrink-0 text-red-600" />
                                )}
                                <div className="min-w-0">
                                    <div className="font-mono text-[11px] truncate">
                                        {r.worker_id}
                                    </div>
                                    <div className="text-[11px] text-muted-foreground">
                                        {r.ok ? "applied" : r.skipped ? "skipped" : r.error || "failed"}
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                )}

                <DialogFooter>
                    <Button variant="outline" onClick={() => setOpen(false)}>
                        {results ? "Close" : "Cancel"}
                    </Button>
                    {!results && (
                        <Button
                            onClick={() => mut.mutate()}
                            disabled={mut.isPending}
                            className="bg-[var(--admin-accent)] hover:bg-[var(--admin-accent-strong)] text-white"
                        >
                            <UploadCloud className="size-4" />
                            {mut.isPending ? "Applying..." : "Apply and restart"}
                        </Button>
                    )}
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}

// --------------------------------------------------------------------
// Delete dialog
// --------------------------------------------------------------------

function DeleteDialog({
    profile,
    onDeleted,
}: {
    profile: WorkerProfile;
    onDeleted: () => void;
}) {
    const [open, setOpen] = useState(false);

    const mut = useMutation({
        mutationFn: () => deleteWorkerProfile(profile.id),
        onSuccess: () => {
            toast.success("Profile deleted");
            setOpen(false);
            onDeleted();
        },
        onError: (e: Error) => toast.error(e.message),
    });

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
                <Button size="sm" variant="ghost">
                    <Trash2 className="size-4" />
                    Delete
                </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-md">
                <DialogHeader>
                    <DialogTitle>Delete {profile.name}?</DialogTitle>
                    <DialogDescription>
                        This removes the profile and its stored secrets. Deletion fails if
                        any workers still use this profile; reassign them first.
                    </DialogDescription>
                </DialogHeader>
                <DialogFooter>
                    <Button variant="outline" onClick={() => setOpen(false)}>
                        Cancel
                    </Button>
                    <Button
                        variant="destructive"
                        onClick={() => mut.mutate()}
                        disabled={mut.isPending}
                    >
                        <Trash2 className="size-4" />
                        {mut.isPending ? "Deleting..." : "Delete profile"}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
