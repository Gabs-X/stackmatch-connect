-- Puts the jobs created before the job board in it, as new jobs are by default. Closed ones only
-- show again if the company reopens them; the company can take any job out in the job form.
UPDATE "jobs" SET "listed" = true;
