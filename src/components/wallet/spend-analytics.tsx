"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatMoney } from "@/lib/types";

const CATEGORY_COLORS = ["#FF6B00", "#FF9E00", "#18181B", "#A1A1AA", "#FDBA74", "#52525B"];

interface Props {
  currency: string;
  burn: { month: string; total: number }[];
  members: { name: string; total: number }[];
  categories: { category: string; total: number }[];
}

export function SpendAnalytics({ currency, burn, members, categories }: Props) {
  const money = (v: number) => formatMoney(v, currency);
  const monthLabel = (m: string) =>
    new Date(m).toLocaleDateString("en-US", { month: "short", year: "2-digit", timeZone: "UTC" });

  return (
    <div className="grid gap-6 lg:grid-cols-3">
      <Card>
        <CardHeader>
          <CardTitle>Monthly burn rate</CardTitle>
        </CardHeader>
        <CardContent className="h-64">
          {burn.length === 0 ? (
            <Empty />
          ) : (
            <ResponsiveContainer>
              <BarChart data={burn}>
                <CartesianGrid vertical={false} stroke="#E4E4E7" />
                <XAxis dataKey="month" tickFormatter={monthLabel} tickLine={false} axisLine={false} fontSize={12} />
                <YAxis tickFormatter={money} tickLine={false} axisLine={false} fontSize={12} width={72} />
                <Tooltip formatter={(v) => money(Number(v))} labelFormatter={(l) => monthLabel(String(l))} />
                <Bar dataKey="total" name="Spent" fill="#FF6B00" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Spend per member</CardTitle>
        </CardHeader>
        <CardContent>
          {members.length === 0 ? (
            <Empty />
          ) : (
            <ol className="flex flex-col gap-3">
              {members.map((m, i) => (
                <li key={m.name + i} className="text-sm">
                  <div className="flex justify-between">
                    <span>
                      <span className="mr-2 text-muted-foreground">{i + 1}.</span>
                      {m.name}
                    </span>
                    <span className="tabular-nums">{money(m.total)}</span>
                  </div>
                  <div className="mt-1 h-1.5 rounded-full bg-muted">
                    <div
                      className="h-full rounded-full bg-secondary"
                      style={{ width: `${(m.total / members[0].total) * 100}%` }}
                    />
                  </div>
                </li>
              ))}
            </ol>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Categories</CardTitle>
        </CardHeader>
        <CardContent className="h-64">
          {categories.length === 0 ? (
            <Empty />
          ) : (
            <ResponsiveContainer>
              <PieChart>
                <Pie data={categories} dataKey="total" nameKey="category" innerRadius={50} outerRadius={85} paddingAngle={2}>
                  {categories.map((c, i) => (
                    <Cell key={c.category} fill={CATEGORY_COLORS[i % CATEGORY_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip formatter={(v) => money(Number(v))} />
                <Legend iconType="circle" wrapperStyle={{ fontSize: 12 }} />
              </PieChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function Empty() {
  return <p className="text-sm text-muted-foreground">No completed spending yet.</p>;
}
