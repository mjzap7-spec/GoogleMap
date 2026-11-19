import { pickDirectFile, receiveDirectFile } from '../../../../shared/platform/directFile';
import type { DirectFileDevice as Device } from '../../models/directTransfer';
export class DirectFileDevice implements Device {
  pick = pickDirectFile;
  receive = receiveDirectFile;
}
