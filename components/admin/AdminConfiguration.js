"use client";

import { useState } from "react";
import { X } from "lucide-react";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";

const verticals = ["FM", "M&E", "Asbestos", "Refurbishment", "Maintenance"];

const initialInviteForm = {
  email: "",
  full_name: "",
  department: "",
  role: "user",
};

function InviteUserModal({ open, onClose }) {
  const [form, setForm] = useState(initialInviteForm);
  const [status, setStatus] = useState("idle");
  const [message, setMessage] = useState("");

  function updateField(field, value) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  async function inviteUser() {
    setStatus("saving");
    setMessage("");

    const response = await fetch("/api/admin/users/invite", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    const payload = await response.json();

    if (!response.ok) {
      setStatus("idle");
      setMessage(payload.error || "Unable to invite user.");
      return;
    }

    setStatus("idle");
    setForm(initialInviteForm);
    setMessage(`Invite sent to ${payload.user.email}. Profile mapped as ${payload.user.role}.`);
  }

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
      <div className="w-full max-w-lg overflow-hidden rounded-xl bg-white shadow-xl">
        <div className="flex items-center justify-between border-b border-gray-200 px-5 py-4">
          <div>
            <div className="text-xs uppercase tracking-wide text-gray-500">User management</div>
            <h2 className="text-lg font-semibold text-gray-950">Invite user</h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md p-2 text-gray-500 hover:bg-gray-100 hover:text-gray-900"
            aria-label="Close"
          >
            <X size={18} />
          </button>
        </div>

        <div className="space-y-4 px-5 py-4">
          <label className="block text-sm">
            <span className="mb-1 block font-medium text-gray-700">Email address *</span>
            <input
              type="email"
              value={form.email}
              onChange={(event) => updateField("email", event.target.value)}
              placeholder="user@company.com"
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
            />
          </label>

          <label className="block text-sm">
            <span className="mb-1 block font-medium text-gray-700">Full name</span>
            <input
              value={form.full_name}
              onChange={(event) => updateField("full_name", event.target.value)}
              placeholder="Jane Smith"
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
            />
          </label>

          <label className="block text-sm">
            <span className="mb-1 block font-medium text-gray-700">Department</span>
            <input
              value={form.department}
              onChange={(event) => updateField("department", event.target.value)}
              placeholder="Sales, Operations, Admin..."
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
            />
          </label>

          <label className="block text-sm">
            <span className="mb-1 block font-medium text-gray-700">Role</span>
            <select
              value={form.role}
              onChange={(event) => updateField("role", event.target.value)}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
            >
              <option value="user">User</option>
              <option value="admin">Admin</option>
            </select>
          </label>

          <div className="rounded-lg bg-blue-50 px-3 py-2 text-sm text-blue-800">
            Supabase sends the invite email. The auth user is then mapped into the profiles table with this role and department.
          </div>

          {message ? (
            <div className="rounded-lg bg-gray-100 px-3 py-2 text-sm text-gray-700">
              {message}
            </div>
          ) : null}
        </div>

        <div className="flex justify-end gap-2 border-t border-gray-200 px-5 py-4">
          <Button type="button" variant="secondary" onClick={onClose} disabled={status !== "idle"}>
            Close
          </Button>
          <Button type="button" onClick={inviteUser} disabled={status !== "idle" || !form.email.trim()}>
            {status === "saving" ? "Sending invite..." : "Send invite"}
          </Button>
        </div>
      </div>
    </div>
  );
}

export function AdminConfiguration() {
  const [rules, setRules] = useState(
    verticals.map((v) => ({ vertical: v, weight: v === "FM" ? 1 : 0.6 }))
  );
  const [inviteOpen, setInviteOpen] = useState(false);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div>
          <p className="text-xs uppercase tracking-wide text-gray-500">Admin</p>
          <h1 className="text-2xl font-semibold text-gray-900">Configuration</h1>
          <p className="text-sm text-gray-600">Manage vertical filters, scoring, API connections, automation.</p>
        </div>
        <Button type="button" onClick={() => setInviteOpen(true)}>
          Invite user
        </Button>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <Card>
          <CardHeader title="Vertical filters" />
          <CardBody className="space-y-3">
            {rules.map((rule) => (
              <div key={rule.vertical} className="flex items-center justify-between">
                <div className="font-medium">{rule.vertical}</div>
                <input
                  type="number"
                  step="0.1"
                  min="0"
                  max="2"
                  className="w-20 rounded-lg border border-gray-300 px-2 py-1 text-sm"
                  value={rule.weight}
                  onChange={(event) =>
                    setRules((current) =>
                      current.map((item) =>
                        item.vertical === rule.vertical ? { ...item, weight: Number(event.target.value) } : item
                      )
                    )
                  }
                />
              </div>
            ))}
            <Button variant="secondary" className="w-full">
              Save weights
            </Button>
          </CardBody>
        </Card>

        <Card>
          <CardHeader title="API connections" />
          <CardBody className="space-y-3 text-sm text-gray-700">
            <div className="flex items-center justify-between">
              <span>Glenigan</span>
              <Badge tone="success">Connected</Badge>
            </div>
            <div className="flex items-center justify-between">
              <span>Pipedrive</span>
              <Badge tone="warning">Check token</Badge>
            </div>
            <Button variant="secondary" className="w-full">
              Manage credentials
            </Button>
          </CardBody>
        </Card>
      </div>

      <Card>
        <CardHeader title="Automation rules" />
        <CardBody className="space-y-3 text-sm text-gray-700">
          <div className="flex items-center justify-between">
            <div>
              <div className="font-medium">Auto-push high confidence</div>
              <div className="text-gray-600">Enable when confidence_score &gt; 0.85 and validation=verified</div>
            </div>
            <input type="checkbox" className="h-4 w-4" />
          </div>
          <div className="flex items-center justify-between">
            <div>
              <div className="font-medium">Require manual review for duplicates</div>
            </div>
            <input type="checkbox" className="h-4 w-4" defaultChecked />
          </div>
        </CardBody>
      </Card>

      <InviteUserModal open={inviteOpen} onClose={() => setInviteOpen(false)} />
    </div>
  );
}
