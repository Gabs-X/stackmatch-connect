import { useState } from "react";
import { addDays, format, isBefore, isWeekend, startOfDay } from "date-fns";
import { ptBR } from "date-fns/locale";
import { ArrowLeft, CalendarDays, Check, Clock3, Mail, Video } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useApp } from "@/lib/app-context";

const availableTimes = ["09:00", "10:30", "14:00", "15:30", "17:00"];

type ScheduleDialogProps = {
  developerId: string;
  developerName: string;
  triggerClassName?: string;
};

export function ScheduleDialog({ developerId, developerName, triggerClassName }: ScheduleDialogProps) {
  const { scheduleAppointment } = useApp();
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState<"schedule" | "details" | "success">("schedule");
  const [date, setDate] = useState<Date>();
  const [time, setTime] = useState("");
  const [company, setCompany] = useState("");
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const today = startOfDay(new Date());

  const reset = () => {
    setStep("schedule");
    setDate(undefined);
    setTime("");
    setCompany("");
    setEmail("");
    setMessage("");
  };

  const handleOpenChange = (nextOpen: boolean) => {
    setOpen(nextOpen);
    if (!nextOpen) window.setTimeout(reset, 200);
  };

  const formattedDate = date ? format(date, "EEEE, d 'de' MMMM", { locale: ptBR }) : "";

  const confirmAppointment = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!date || !time || !company.trim() || !email.trim()) return;
    scheduleAppointment({
      id: `${developerId}-${date.toISOString()}-${time}`,
      developerId,
      developerName,
      date: format(date, "yyyy-MM-dd"),
      time,
      company: company.trim(),
      email: email.trim(),
      message: message.trim(),
    });
    setStep("success");
    toast.success("Conversa agendada", { description: `${formattedDate}, às ${time}.` });
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button className={triggerClassName}><CalendarDays />Agendar conversa</Button>
      </DialogTrigger>
      <DialogContent className="max-h-[92vh] max-w-[calc(100%-1.5rem)] overflow-y-auto p-0 sm:max-w-3xl">
        <div className="border-b px-5 py-5 sm:px-7">
          <DialogHeader>
            <div className="mb-2 flex items-center gap-2 text-xs font-bold uppercase text-primary">
              <Video className="size-4" /> Conversa de 30 minutos
            </div>
            <DialogTitle className="font-display text-2xl">Converse com {developerName.split(" ")[0]}</DialogTitle>
            <DialogDescription>Escolha um horário e conte brevemente sobre a oportunidade.</DialogDescription>
          </DialogHeader>
        </div>

        {step === "schedule" && (
          <div className="grid gap-0 md:grid-cols-[1fr_220px]">
            <div className="border-b p-4 md:border-b-0 md:border-r sm:p-6">
              <p className="mb-3 text-sm font-bold">Escolha uma data</p>
              <Calendar
                mode="single"
                selected={date}
                onSelect={(selected) => { setDate(selected); setTime(""); }}
                disabled={(day) => isBefore(day, today) || isWeekend(day)}
                fromMonth={today}
                toMonth={addDays(today, 90)}
                locale={ptBR}
                className="pointer-events-auto mx-auto w-full bg-transparent [--cell-size:2.45rem]"
              />
            </div>
            <div className="p-5 sm:p-6">
              <p className="text-sm font-bold">Horários disponíveis</p>
              <p className="mt-1 text-xs leading-5 text-muted-foreground">
                {date ? formattedDate : "Selecione uma data no calendário"}
              </p>
              <div className="mt-4 grid grid-cols-2 gap-2 md:grid-cols-1">
                {availableTimes.map((slot) => (
                  <Button
                    key={slot}
                    type="button"
                    variant={time === slot ? "default" : "outline"}
                    disabled={!date}
                    onClick={() => setTime(slot)}
                    className="justify-center"
                  >
                    <Clock3 />{slot}
                  </Button>
                ))}
              </div>
              <Button className="mt-5 w-full" disabled={!date || !time} onClick={() => setStep("details")}>
                Continuar
              </Button>
              <p className="mt-3 text-center text-xs text-muted-foreground">Horário de Brasília (GMT−3)</p>
            </div>
          </div>
        )}

        {step === "details" && (
          <form onSubmit={confirmAppointment} className="grid gap-6 p-5 md:grid-cols-[1fr_260px] sm:p-7">
            <div className="space-y-5">
              <div>
                <Label htmlFor="schedule-company">Empresa</Label>
                <Input id="schedule-company" value={company} onChange={(event) => setCompany(event.target.value)} placeholder="Nome da sua empresa" className="mt-2 h-11" required />
              </div>
              <div>
                <Label htmlFor="schedule-email">E-mail corporativo</Label>
                <Input id="schedule-email" type="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="voce@empresa.com" className="mt-2 h-11" required />
              </div>
              <div>
                <Label htmlFor="schedule-message">Sobre a oportunidade <span className="font-normal text-muted-foreground">(opcional)</span></Label>
                <Textarea id="schedule-message" value={message} onChange={(event) => setMessage(event.target.value)} placeholder="Conte sobre o projeto, desafio ou posição..." className="mt-2 min-h-24 resize-none" />
              </div>
            </div>
            <aside className="rounded-lg border bg-muted/60 p-5">
              <p className="text-xs font-bold uppercase text-muted-foreground">Resumo</p>
              <div className="mt-4 space-y-4 text-sm">
                <div className="flex gap-3"><CalendarDays className="mt-0.5 size-4 text-primary" /><div><p className="font-bold first-letter:uppercase">{formattedDate}</p><p className="text-muted-foreground">às {time}</p></div></div>
                <div className="flex gap-3"><Clock3 className="mt-0.5 size-4 text-primary" /><div><p className="font-bold">30 minutos</p><p className="text-muted-foreground">Horário de Brasília</p></div></div>
                <div className="flex gap-3"><Video className="mt-0.5 size-4 text-primary" /><div><p className="font-bold">Videochamada</p><p className="text-muted-foreground">Link simulado após confirmar</p></div></div>
              </div>
              <Button type="submit" className="mt-6 w-full"><Check />Confirmar horário</Button>
              <Button type="button" variant="ghost" className="mt-2 w-full" onClick={() => setStep("schedule")}><ArrowLeft />Alterar horário</Button>
            </aside>
          </form>
        )}

        {step === "success" && (
          <div className="px-6 py-10 text-center sm:px-12 sm:py-14">
            <div className="mx-auto grid size-14 place-items-center rounded-full bg-positive-soft text-positive"><Check className="size-7" /></div>
            <h3 className="mt-5 font-display text-2xl font-bold">Conversa agendada</h3>
            <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-muted-foreground">
              Seu horário com {developerName} foi reservado para <span className="font-semibold text-foreground first-letter:uppercase">{formattedDate}, às {time}</span>.
            </p>
            <div className="mx-auto mt-6 flex max-w-sm items-center gap-3 rounded-lg border bg-muted/60 p-4 text-left text-sm">
              <Mail className="size-5 shrink-0 text-primary" />
              <span>Uma confirmação simulada foi preparada para <strong>{email}</strong>.</span>
            </div>
            <Button className="mt-7" onClick={() => setOpen(false)}>Concluir</Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}