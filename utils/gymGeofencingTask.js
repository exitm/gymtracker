import * as TaskManager from 'expo-task-manager';
import * as Notifications from 'expo-notifications';
import { GeofencingEventType } from 'expo-location';

export const GEOFENCING_TASK = 'GYM_GEOFENCING_TASK';

TaskManager.defineTask(GEOFENCING_TASK, async ({ data, error }) => {
  if (error) {
    console.error('Gym geofencing task error:', error);
    return;
  }

  if (data?.eventType !== GeofencingEventType.Enter) return;

  try {
    await Notifications.scheduleNotificationAsync({
      content: {
        title: '헬스장 도착',
        body: '운동할 시간이에요. 오늘의 운동을 기록해 보세요!',
        data: { type: 'gym-geofence' },
      },
      trigger: null,
    });
  } catch (notificationError) {
    console.error('Gym geofencing notification error:', notificationError);
  }
});
