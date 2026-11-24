import { AlertAction } from './alertPolicy.js';
import { AlarmSound } from '../audio/AudioAlertService.js';

/** Security event -> (cooldown policy) -> audio alarm + history entry. DOM-free so it is testable. */
export function createAlertController({ policy, audio, history }) {
  return {
    /** `presence`: optional { rssi (smoothed), readings } from the device tracker. */
    handle(event, presence = null) {
      const decision = policy.evaluate(event, presence);

      if (decision.action === AlertAction.IGNORE) return { action: AlertAction.IGNORE };

      if (decision.action === AlertAction.SUPPRESS) {
        return { action: AlertAction.SUPPRESS, entry: history.recordRepeat(event) };
      }

      // decision.sound: 'siren' (verified unauthorized) | 'warning' (unknown at a checkpoint) | null
      let sound = 'none';
      if (decision.sound && event.offline) {
        sound = 'offline'; // past detection replayed after an outage: alert visually, no sound
      } else if (decision.sound) {
        const played = audio.playAlarm(decision.sound === 'warning' ? AlarmSound.WARNING : AlarmSound.UNAUTHORIZED);
        sound = !played.played ? played.reason : decision.sound === 'warning' ? 'warning' : 'played';
      }
      return { action: AlertAction.NOTIFY, entry: history.add(event, { sound }), sound };
    },
  };
}
