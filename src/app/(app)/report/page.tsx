import type { Metadata } from "next";

import { ReportForm } from "./report-form";
import { ScreenHeader } from "@/components/ui/screen-header";

export const metadata: Metadata = { title: "Report a problem" };

export default function ReportPage() {
  return (
    <div className="flex flex-1 flex-col">
      <ScreenHeader title="Report a problem" back="/settings" />
      <div className="flex flex-col gap-5 px-5 pb-8 pt-2">
        <p className="text-base text-muted">
          Tell us what happened — bug, scam, harassment, missing place, broken
          feature. Our team reads every report.
        </p>
        <ReportForm />

        <div className="wc-frame rounded-2xl p-4 text-sm text-muted">
          <p className="font-bold text-foreground">For urgent safety issues</p>
          <p className="mt-1">
            If you or another traveler is in immediate danger, contact local
            emergency services first. Then send us details at{" "}
            <a
              className="font-semibold text-glow underline"
              href="mailto:safety@wondavu.com"
            >
              safety@wondavu.com
            </a>{" "}
            so we can act fast.
          </p>
        </div>
      </div>
    </div>
  );
}
