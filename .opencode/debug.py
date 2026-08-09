with open(r'C:\Users\Superak0s\Documents\Coding\OwnLift\OwnLift-App\src\features\tracking\TrackingScreen.tsx', 'r') as f:
    lines = f.readlines()
for i in range(180, 195):
    print(f'{i+1}: {repr(lines[i][:100])}')