import BodyForm from "@/components/health/body-form";
import { LogList, LogWeight, WeightChart } from "@/components/health/body-stats";
import { todayISO } from "@/lib/finance";
import {
  bmi,
  bmiBand,
  bmr,
  bodyFatBand,
  idealWeightRange,
  navyBodyFat,
  nutritionTargets,
  tdee,
} from "@/lib/fitness";
import {
  getBodyLogs,
  getBodyProfile,
  getCurrentBlock,
} from "@/lib/health-queries";
import { Card, CardGrid } from "@/components/ui/kit";

const kg = (n: number) => `${n.toFixed(1)} kg`;

export default async function BodyPage() {
  const today = todayISO();
  const [profile, logs, block] = await Promise.all([
    getBodyProfile(),
    getBodyLogs(),
    getCurrentBlock(),
  ]);
  const latest = logs[0] ?? null;

  const height = profile?.height_cm ?? null;
  const weight = latest?.weight_kg ?? null;
  const bmiValue = height && weight ? bmi(weight, height) : null;
  const band = bmiValue ? bmiBand(bmiValue) : null;
  const ideal = height ? idealWeightRange(height) : null;
  const restingRate =
    profile && weight
      ? bmr({ sex: profile.sex, age: profile.age, height_cm: height, weight_kg: weight })
      : null;
  const maintenance = restingRate && profile ? tdee(restingRate, profile.activity) : null;
  const targets =
    maintenance && profile && weight
      ? nutritionTargets(maintenance, profile.goal, weight)
      : null;
  const fat =
    profile && latest
      ? navyBodyFat({
          sex: profile.sex,
          height_cm: height,
          waist_cm: latest.waist_cm,
          neck_cm: latest.neck_cm,
          hip_cm: latest.hip_cm,
        })
      : null;

  const tone = (t?: "good" | "warn" | "bad") =>
    t === "good" ? "text-moss" : t === "bad" ? "text-red-700 dark:text-red-300" : t === "warn" ? "text-chart-expense" : "";

  return (
    <CardGrid align="start">
      <Card>
        <h3 className="font-bold tracking-tight text-xl sm:text-2xl">Your numbers</h3>
        {bmiValue ? (
          <>
            <div className="mt-4 flex items-end gap-3">
              <span className="text-4xl font-semibold tracking-tight tabular-nums">
                {bmiValue.toFixed(1)}
              </span>
              <span className="pb-1 text-sm text-paper/70">
                BMI ·{" "}
                <span className={tone(band?.tone)}>{band?.label}</span>
              </span>
            </div>
            <Scale value={bmiValue} />
            <dl className="mt-5 grid grid-cols-2 gap-4 text-sm">
              {ideal && (
                <Stat
                  label="Healthy weight"
                  value={`${kg(ideal.min)} – ${kg(ideal.max)}`}
                  hint={
                    weight && weight > ideal.max
                      ? `${kg(weight - ideal.max)} above the range`
                      : weight && weight < ideal.min
                        ? `${kg(ideal.min - weight)} below the range`
                        : "You're in the range"
                  }
                />
              )}
              {fat !== null && profile && (
                <Stat
                  label="Body fat (estimate)"
                  value={`${fat.toFixed(1)}%`}
                  hint={bodyFatBand(fat, profile.sex)}
                />
              )}
              {restingRate && (
                <Stat label="Resting burn" value={`${Math.round(restingRate)} kcal`} />
              )}
              {maintenance && (
                <Stat label="Daily burn" value={`${Math.round(maintenance)} kcal`} />
              )}
            </dl>

            {targets && (
              <div className="mt-5 rounded-2xl border border-paper/10 bg-inset p-4">
                <p className="text-xs font-medium uppercase tracking-wider text-paper/65">
                  Daily target for your goal
                </p>
                <p className="mt-1 text-2xl font-semibold tabular-nums">
                  {targets.calories} kcal
                </p>
                <div className="mt-3 grid grid-cols-3 gap-3 text-sm">
                  <Stat label="Protein" value={`${targets.protein} g`} />
                  <Stat label="Carbs" value={`${targets.carbs} g`} />
                  <Stat label="Fat" value={`${targets.fat} g`} />
                </div>
              </div>
            )}

            <p className="mt-4 text-xs text-paper/55">
              Estimates, not medical advice; BMI can&apos;t tell muscle from fat.
            </p>
          </>
        ) : (
          <p className="py-8 text-center text-sm text-paper/65">
            Add your height and weight to see BMI, calories and your plan.
          </p>
        )}
      </Card>

      <div className="flex min-w-0 flex-col gap-3">
        <Card>
          <h3 className="mb-3 font-bold tracking-tight text-[19px]">Weight</h3>
          {profile && <LogWeight profile={profile} latest={latest} date={today} />}
          <WeightChart logs={logs} goal={profile?.goal ?? null} />
          <LogList logs={logs} />
        </Card>

        <BodyForm
          // A weight logged above has to reach the form too, or saving the
          // form would put the old weight back
          key={latest ? `${latest.logged_on}:${latest.weight_kg}` : "none"}
          profile={profile}
          latest={latest}
          date={today}
          hasBlock={Boolean(block)}
        />
      </div>
    </CardGrid>
  );
}

function Stat({
  label,
  value,
  hint,
}: {
  label: string;
  value: string;
  hint?: string;
}) {
  return (
    <div className="min-w-0">
      <dt className="truncate text-xs text-paper/65">{label}</dt>
      <dd className="truncate font-semibold tabular-nums">{value}</dd>
      {hint && <dd className="truncate text-xs text-paper/55">{hint}</dd>}
    </div>
  );
}

// 15 to 35 BMI, with your position marked
function Scale({ value }: { value: number }) {
  const position = Math.min(Math.max((value - 15) / 20, 0), 1) * 100;
  return (
    <div className="mt-3">
      <div className="relative h-2.5 overflow-hidden rounded-full">
        <div className="absolute inset-0 flex">
          <span className="w-[17.5%] bg-chart-expense/50" />
          <span className="w-[22.5%] bg-moss" />
          <span className="w-[10%] bg-moss/60" />
          <span className="w-[25%] bg-chart-expense/60" />
          <span className="flex-1 bg-red-500/70" />
        </div>
        <span
          className="absolute top-1/2 h-4 w-1 -translate-x-1/2 -translate-y-1/2 rounded-full bg-paper shadow"
          style={{ left: `${position}%` }}
        />
      </div>
      <div className="mt-1 flex justify-between text-[10px] text-paper/50">
        <span>15</span>
        <span>18.5</span>
        <span>23</span>
        <span>25</span>
        <span>30</span>
        <span>35</span>
      </div>
    </div>
  );
}
