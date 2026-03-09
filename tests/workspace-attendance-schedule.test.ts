import { describe, expect, it } from 'vitest';

import {
  buildAttendanceScheduleDraft,
  serializeAttendanceScheduleDraft,
} from '../lib/workspace-attendance-schedule';

describe('workspace attendance schedule helpers', () => {
  it('builds all 7 weekday rows in canonical order', () => {
    const rows = buildAttendanceScheduleDraft();

    expect(rows).toHaveLength(7);
    expect(rows.map((row) => row.day)).toEqual([
      'monday',
      'tuesday',
      'wednesday',
      'thursday',
      'friday',
      'saturday',
      'sunday',
    ]);
  });

  it('keeps edited time values in the save payload', () => {
    const rows = buildAttendanceScheduleDraft();
    rows[1].checkInTime = '09:15';

    expect(serializeAttendanceScheduleDraft(rows)[1]).toEqual({
      day: 'tuesday',
      enabled: true,
      checkInTime: '09:15',
    });
  });

  it('drops checkInTime from disabled rows in the save payload', () => {
    const rows = buildAttendanceScheduleDraft();
    rows[0].enabled = false;
    rows[0].checkInTime = '08:30';

    expect(serializeAttendanceScheduleDraft(rows)[0]).toEqual({
      day: 'monday',
      enabled: false,
    });
  });
});
