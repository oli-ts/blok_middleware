"use client";

import { useState } from "react";
import { Card, CardBody, CardHeader } from "../../../../components/ui/Card";
import { Button } from "../../../../components/ui/Button";
import { Badge } from "../../../../components/ui/Badge";

const defaultMapping = {
  deal: { title: "projects.title", value: "projects.value_numeric" },
  person: { name: "contacts.full_name", email: "contacts.email" },
  org: { name: "companies.name", region: "companies.region" },
};

export default function CrmPushPage() {
  const [mapping, setMapping] = useState(defaultMapping);
  const [status, setStatus] = useState(null);

  function updateMapping(entity, field, value) {
    setMapping((prev) => ({
      ...prev,
      [entity]: { ...prev[entity], [field]: value },
    }));
  }

  function handlePush() {
    setStatus("queued");
    setTimeout(() => setStatus("success"), 800);
  }

  return (
    <div className="space-y-6">
      <div>
        <p className="text-xs uppercase tracking-wide text-neutral-500">CRM</p>
        <h1 className="text-2xl font-semibold text-neutral-900">Mapping & Push</h1>
        <p className="text-sm text-neutral-600">Preview mappings before creating Deals, People, Organisations.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {["deal", "person", "org"].map((entity) => (
          <Card key={entity}>
            <CardHeader title={entity === "org" ? "Organisation" : entity[0].toUpperCase() + entity.slice(1)} />
            <CardBody className="space-y-3">
              {Object.entries(mapping[entity]).map(([field, value]) => (
                <div key={field} className="space-y-1">
                  <label className="text-xs font-medium text-neutral-700 uppercase">{field}</label>
                  <input
                    value={value}
                    onChange={(e) => updateMapping(entity, field, e.target.value)}
                    className="w-full rounded-md border border-neutral-200 px-3 py-2 text-sm focus:border-black focus:outline-none"
                  />
                </div>
              ))}
              <div className="text-xs text-neutral-500">Required fields flagged in Pipedrive payload.</div>
            </CardBody>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader
          title="Preview"
          action={
            <Button onClick={handlePush}>
              {status === "queued" ? "Pushing..." : status === "success" ? "Push again" : "Push selected"}
            </Button>
          }
        />
        <CardBody className="space-y-3 text-sm text-neutral-700">
          <div>Validation warnings and required fields will render here.</div>
          {status === "queued" && <Badge tone="info">Job queued</Badge>}
          {status === "success" && <Badge tone="success">Push completed (mock)</Badge>}
        </CardBody>
      </Card>
    </div>
  );
}
