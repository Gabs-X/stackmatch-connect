export type Appointment = {
  id: string;
  developerId: string;
  developerName: string;
  date: string;
  time: string;
  company: string;
  email: string;
  message: string;
};

export const appointmentTimes = ["09:00", "10:30", "14:00", "15:30", "17:00"];
export const appointmentStorageKey = "stackmatch-appointments";

export function isSlotAvailable(
  appointments: Appointment[],
  developerId: string,
  date: string,
  time: string,
  now = Date.now(),
) {
  const timestamp = Date.parse(`${date}T${time}:00-03:00`);
  return (
    appointmentTimes.includes(time) &&
    Number.isFinite(timestamp) &&
    timestamp > now &&
    !appointments.some(
      (item) => item.developerId === developerId && item.date === date && item.time === time,
    )
  );
}

export function readAppointments(): Appointment[] {
  const value: unknown = JSON.parse(window.localStorage.getItem(appointmentStorageKey) ?? "[]");
  if (!Array.isArray(value)) return [];
  return value.filter(
    (item): item is Appointment =>
      item &&
      ["id", "developerId", "developerName", "date", "time", "company", "email", "message"].every(
        (key) => typeof item[key] === "string",
      ),
  );
}
