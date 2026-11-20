import {
  pickDirectFile,
  receiveDirectFile,
  findDirectFile,
} from '../../../../shared/platform/directFile';
import type { DirectFileDevice as Device } from '../../models/directTransfer';
export class DirectFileDevice implements Device {
  find = findDirectFile;
  pick = pickDirectFile;
  receive = receiveDirectFile;
}
