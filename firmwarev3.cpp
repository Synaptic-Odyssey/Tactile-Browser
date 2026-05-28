const int LATCH_PIN = 10;
const int DATA_PIN  = 11;
const int CLOCK_PIN = 13;

const int PWM_PIN   = 9;
const int STBY_PIN  = 12;

const int ROWS = 3;
const int COLS = 6;

const int NUM_595 = 5;

const int PULSE_MS = 14;

const int MAX_BATCH = 10;

byte regs[NUM_595] = {0,0,0,0,0};

struct SolenoidMap {

  int regIndex;
  int bitRaise;
  int bitLower;
};

SolenoidMap solenoids[18] = {

  {1,0,1},
  {1,2,3},
  {1,4,5},
  {1,6,7},

  {2,0,1},
  {2,2,3},
  {2,4,5},
  {2,6,7},

  {3,0,1},
  {3,2,3},
  {3,4,5},
  {3,6,7},

  {-1,-1,-1},
  {-1,-1,-1},
  {-1,-1,-1},
  {-1,-1,-1},
  {-1,-1,-1},
  {-1,-1,-1}
};

void setup() {

  Serial.begin(115200);

  pinMode(LATCH_PIN, OUTPUT);
  pinMode(DATA_PIN, OUTPUT);
  pinMode(CLOCK_PIN, OUTPUT);

  pinMode(PWM_PIN, OUTPUT);
  pinMode(STBY_PIN, OUTPUT);

  digitalWrite(STBY_PIN, LOW);

  analogWrite(PWM_PIN, 0);

  clearAllRegisters();

  delay(500);

  analogWrite(PWM_PIN, 255);

  digitalWrite(STBY_PIN, HIGH);

  Serial.println("READY");
}

void loop() {

  handleSerialInput();
}

void handleSerialInput() {

  if (!Serial.available())
    return;

  String line =
    Serial.readStringUntil('\n');

  line.trim();

  if (line.length() != 18) {

    Serial.println("BAD LENGTH");

    return;
  }

  bool pattern[3][6];

  int index = 0;

  for (int r = 0; r < ROWS; r++) {

    for (int c = 0; c < COLS; c++) {

      pattern[r][c] =
        (line[index] == '1');

      index++;
    }
  }

  applyPattern(pattern);

  Serial.println("OK");
}

void applyPattern(bool pattern[3][6]) {

  int batchCount = 0;

  clearAllRegisters();

  for (int r = 0; r < ROWS; r++) {

    for (int c = 0; c < COLS; c++) {

      int index =
        r * 6 + c;

      activateSolenoid(
        index,
        false
      );

      batchCount++;

      if (batchCount >= MAX_BATCH) {

        writeAllRegisters();

        delay(PULSE_MS);

        clearAllRegisters();

        delay(12);

        batchCount = 0;
      }
    }
  }

  if (batchCount > 0) {

    writeAllRegisters();

    delay(PULSE_MS);

    clearAllRegisters();

    delay(20);
  }

  batchCount = 0;

  clearAllRegisters();

  for (int r = 0; r < ROWS; r++) {

    for (int c = 0; c < COLS; c++) {

      if (!pattern[r][c])
        continue;

      int index =
        r * 6 + c;

      activateSolenoid(
        index,
        true
      );

      batchCount++;

      if (batchCount >= MAX_BATCH) {

        writeAllRegisters();

        delay(PULSE_MS);

        clearAllRegisters();

        delay(12);

        batchCount = 0;
      }
    }
  }

  if (batchCount > 0) {

    writeAllRegisters();

    delay(PULSE_MS);

    clearAllRegisters();
  }
}

void activateSolenoid(
  int index,
  bool raise
) {

  if (index < 0 || index >= 18)
    return;

  SolenoidMap s =
    solenoids[index];

  if (s.regIndex == -1)
    return;

  if (raise) {

    regs[s.regIndex] |=
      (1 << s.bitRaise);

  } else {

    regs[s.regIndex] |=
      (1 << s.bitLower);
  }
}

void writeAllRegisters() {

  digitalWrite(LATCH_PIN, LOW);

  for (
    int i = NUM_595 - 1;
    i >= 0;
    i--
  ) {

    shiftOut(
      DATA_PIN,
      CLOCK_PIN,
      MSBFIRST,
      regs[i]
    );
  }

  digitalWrite(LATCH_PIN, HIGH);
}

void clearAllRegisters() {

  for (int i = 0; i < NUM_595; i++) {

    regs[i] = 0;
  }

  writeAllRegisters();
}