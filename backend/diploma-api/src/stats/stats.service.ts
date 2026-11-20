import { Injectable } from '@nestjs/common';
import { StoreService } from '../common/store.service';
import { DiplomasService } from '../diplomas/diplomas.service';

export interface MonthlyStat {
  month: string; // AAAA-MM
  issued: number;
  revoked: number;
  verifications: number;
}

export interface Stats {
  generatedAt: string;
  totals: { issued: number; valid: number; revoked: number; verifications: number };
  months: MonthlyStat[];
}

@Injectable()
export class StatsService {
  constructor(
    private readonly diplomas: DiplomasService,
    private readonly store: StoreService,
  ) {}

  /** Statistiques des 12 derniers mois, calculées à partir du registre. */
  async compute(): Promise<Stats> {
    const records = await this.diplomas.listAll();
    const counters = this.store.verifications();

    const months: MonthlyStat[] = [];
    const now = new Date();
    for (let i = 11; i >= 0; i--) {
      const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - i, 1));
      const key = d.toISOString().slice(0, 7);
      months.push({ month: key, issued: 0, revoked: 0, verifications: counters[key] ?? 0 });
    }
    const index = new Map(months.map((m) => [m.month, m]));
    for (const r of records) {
      const created = index.get(r.createdAt.slice(0, 7));
      if (created) created.issued += 1;
      if (r.revokedAt) {
        const revoked = index.get(r.revokedAt.slice(0, 7));
        if (revoked) revoked.revoked += 1;
      }
    }

    const revoked = records.filter((r) => r.status === 'REVOKED').length;
    return {
      generatedAt: now.toISOString(),
      totals: {
        issued: records.length,
        valid: records.length - revoked,
        revoked,
        verifications: Object.values(counters).reduce((a, b) => a + b, 0),
      },
      months,
    };
  }
}
