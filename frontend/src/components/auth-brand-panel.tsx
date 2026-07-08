import { MessageCircle, Repeat, Target, Wallet } from "lucide-react";

const FEATURES = [
  { icon: Target, text: "Kategori bazında bütçe belirle, aşmadan takip et" },
  { icon: Repeat, text: "Tekrarlayan abonelikleri otomatik yakala" },
  { icon: MessageCircle, text: "Finans koçuna harcamalarınla ilgili soru sor" },
];

export function AuthBrandPanel() {
  return (
    <div className="relative hidden overflow-hidden bg-gradient-to-br from-indigo-600 via-indigo-700 to-violet-900 lg:flex lg:w-1/2 lg:flex-col lg:justify-between lg:p-12">
      <div className="pointer-events-none absolute -top-24 -right-24 h-72 w-72 rounded-full bg-white/10 blur-3xl" />
      <div className="pointer-events-none absolute bottom-0 left-0 h-96 w-96 rounded-full bg-violet-400/20 blur-3xl" />

      <div className="relative flex items-center gap-2 text-lg font-semibold text-white">
        <Wallet className="h-6 w-6" />
        SmartSpend AI
      </div>

      <div className="relative">
        <h2 className="text-3xl font-bold leading-tight text-white">
          Paranı yönet,
          <br />
          hedeflerine ulaş.
        </h2>
        <p className="mt-3 max-w-sm text-sm text-indigo-100">
          Harcamalarını tek yerden takip et, nereye para gittiğini gör ve
          kontrolü elinde tut.
        </p>

        <ul className="mt-8 space-y-4">
          {FEATURES.map(({ icon: Icon, text }) => (
            <li key={text} className="flex items-center gap-3 text-sm text-white">
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-white/15">
                <Icon className="h-4 w-4" />
              </span>
              {text}
            </li>
          ))}
        </ul>
      </div>

      <p className="relative text-xs text-indigo-200">
        © {new Date().getFullYear()} SmartSpend AI
      </p>
    </div>
  );
}
