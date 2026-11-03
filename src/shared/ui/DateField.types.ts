export interface DateFieldProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  minimumDate: Date;
  maximumDate: Date;
  initialDate?: Date;
}
