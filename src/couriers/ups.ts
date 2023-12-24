import * as codes from '../util/codes.json';
import { getTime, parse as dateParser } from 'date-fns';
import { Courier, TrackingEvent, TrackingInfo } from '../util/types';
import {
  always,
  apply,
  applySpec,
  both,
  complement,
  compose,
  concat,
  converge,
  either,
  equals,
  filter,
  ifElse,
  includes,
  isEmpty,
  isNil,
  join,
  map,
  nthArg,
  path,
  pathEq,
  paths,
  pipe,
  prop,
  propOr,
  props,
  __,
} from 'ramda';
import { ups } from 'ts-tracking-number';

const getDate: (date: string, time: string) => number = pipe<any, Date, number>(
  converge(dateParser, [
    concat,
    converge(concat, [
      ifElse(nthArg(0), always('yyyyMMdd'), always('')),
      ifElse(nthArg(1), always('Hmmss'), always('')),
    ]),
    always(Date.now()),
  ]),
  getTime
);

const getLocation: (activity: any) => string = pipe<
  any,
  any,
  string[],
  string[],
  string
>(
  path(['location', 'address']),
  props(['city', 'stateProvince', 'countryCode', 'postalCode']),
  filter(complement(either(isNil, isEmpty))),
  ifElse(isEmpty, always(undefined), join(' '))
);

const getStatus: (activity: any) => string = pipe<any, any, string>(
  path(['status']),
  ifElse(
    both(
      equals('EXCEPTION'),
      compose(includes('DELIVERY ATTEMPT'), prop('description'))
    ),
    always('DELIVERY_ATTEMPTED'),
    pipe<any, string, string>(
      prop('type'),
      propOr('UNAVAILABLE', __, codes.ups)
    )
  )
);

const getTrackingEvent: (activity: any) => TrackingEvent =
  applySpec<TrackingEvent>({
    status: getStatus,
    label: path(['status', 'description']),
    location: getLocation,
    date: pipe(props(['date', 'time']), apply(getDate)),
  });

const getTrackingEvents: (packageDetails: any) => TrackingEvent[] = pipe<
  any,
  any,
  TrackingEvent[]
>(prop('activity'), map(getTrackingEvent));

const getEstimatedDeliveryDate: (packageDetails: any) => number = ifElse(
  pathEq(['deliveryTime', 'type'], 'EDW'),
  pipe(
    paths([
      ['deliveryDate', '0', 'date'],
      ['deliveryTime', 'endTime'],
    ]),
    apply(getDate)
  ),
  always(undefined)
);

const parse = (response: any): TrackingInfo => {
  const { body } = response;

  const json = JSON.parse(body);

  const shipment: any = path(['trackResponse', 'shipment', '0'], json);

  if (
    shipment == null ||
    'Tracking Information Not Found' ===
      path(['warnings', '0', 'message'], shipment)
  ) {
    throw new Error(`Error retrieving UPS tracking.
    
    Shipment: 
    ${JSON.stringify(shipment)}
    
    Full response body:
    ${JSON.stringify(body)}
    `);
  }

  const pkg = path(['package', 0], shipment);

  const events = getTrackingEvents(pkg);
  const estimatedDeliveryDate = getEstimatedDeliveryDate(pkg);

  return {
    events,
    estimatedDeliveryDate,
  };
};

const UPS: Courier<'ups'> = {
  name: 'UPS',
  code: 'ups',
  requiredEnvVars: ['UPS_ACCESS_LICENSE_NUMBER'],
  request: (trackingNumber: string) =>
    fetch('https://onlinetools.ups.com/track/v1/details/' + trackingNumber),
  parse,
  tsTrackingNumberCouriers: [ups],
};

export default UPS;
