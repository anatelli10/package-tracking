import { TrackingCourier } from 'ts-tracking-number';
import * as couriers from '../couriers';
import { Couriers } from '..';

export type TrackingEvent = {
  status?: string;
  label?: string;
  location?: string;
  date?: number;
};

export type TrackingInfo = {
  events: TrackingEvent[];
  estimatedDeliveryDate?: number;
};

export type TrackingOptions = {
  /**
   * Explicitly define a courier code to bypass auto-detection
   */
  courierCode: 's10' | Couriers[keyof Couriers]['code'];
};

export type Courier<Code> = {
  name: string;
  code: Code;
  requiredEnvVars?: string[];
  request: (trackingNumber: string) => Promise<any>;
  parse: <T>(response: T) => TrackingInfo;
  tsTrackingNumberCouriers: readonly TrackingCourier[];
};
