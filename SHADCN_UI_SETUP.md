# shadcn/ui Components Setup

## Installed Components

All shadcn/ui base components have been successfully installed in `src/renderer/components/ui/`:

### Form Components
- **button.tsx** - Button component with variants (default, destructive, outline, secondary, ghost, link)
- **input.tsx** - Text input component
- **textarea.tsx** - Multi-line text input
- **label.tsx** - Form label component
- **select.tsx** - Dropdown select component
- **switch.tsx** - Toggle switch component

### Layout Components
- **card.tsx** - Card container with Header, Title, Description, Content, Footer
- **tabs.tsx** - Tabbed interface with TabsList, TabsTrigger, TabsContent
- **separator.tsx** - Horizontal/vertical divider
- **scroll-area.tsx** - Custom scrollable area

### Overlay Components
- **dialog.tsx** - Modal dialog with Trigger, Content, Header, Title, Description, Footer
- **sheet.tsx** - Slide-out panel (side drawer)
- **dropdown-menu.tsx** - Context menu component
- **tooltip.tsx** - Tooltip with TooltipProvider

### Feedback Components
- **toast.tsx** - Toast notification system
- **use-toast.ts** - Toast hook for triggering notifications
- **toaster.tsx** - Toast container component
- **alert.tsx** - Alert box with variants
- **progress.tsx** - Progress bar
- **skeleton.tsx** - Loading skeleton

### Display Components
- **badge.tsx** - Small status indicator
- **avatar.tsx** - User avatar with Image and Fallback

## Installed Dependencies

```json
{
  "dependencies": {
    "@radix-ui/react-alert-dialog": "^1.1.15",
    "@radix-ui/react-avatar": "^1.1.11",
    "@radix-ui/react-dialog": "^1.1.15",
    "@radix-ui/react-dropdown-menu": "^2.1.16",
    "@radix-ui/react-label": "^2.1.8",
    "@radix-ui/react-progress": "^1.1.8",
    "@radix-ui/react-scroll-area": "^1.2.10",
    "@radix-ui/react-select": "^2.2.6",
    "@radix-ui/react-separator": "^1.1.8",
    "@radix-ui/react-slot": "^1.2.4",
    "@radix-ui/react-switch": "^1.2.6",
    "@radix-ui/react-tabs": "^1.1.13",
    "@radix-ui/react-toast": "^1.2.15",
    "@radix-ui/react-tooltip": "^1.2.8"
  },
  "devDependencies": {
    "class-variance-authority": "^0.7.1",
    "lucide-react": "^0.460.0"
  }
}
```

## Usage Examples

### Button
```tsx
import { Button } from '@/components/ui/button';

<Button variant="default">Click me</Button>
<Button variant="destructive">Delete</Button>
<Button variant="outline">Cancel</Button>
```

### Dialog
```tsx
import {
  Dialog,
  DialogTrigger,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';

<Dialog>
  <DialogTrigger asChild>
    <Button>Open Dialog</Button>
  </DialogTrigger>
  <DialogContent>
    <DialogHeader>
      <DialogTitle>Are you sure?</DialogTitle>
      <DialogDescription>
        This action cannot be undone.
      </DialogDescription>
    </DialogHeader>
    <DialogFooter>
      <Button variant="outline">Cancel</Button>
      <Button>Confirm</Button>
    </DialogFooter>
  </DialogContent>
</Dialog>
```

### Toast
```tsx
import { useToast } from '@/components/ui/use-toast';
import { Toaster } from '@/components/ui/toaster';

// In your app root:
function App() {
  return (
    <>
      {/* Your app content */}
      <Toaster />
    </>
  );
}

// In any component:
function MyComponent() {
  const { toast } = useToast();

  return (
    <Button
      onClick={() => {
        toast({
          title: "Success",
          description: "Your changes have been saved.",
        });
      }}
    >
      Save
    </Button>
  );
}
```

### Card
```tsx
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
} from '@/components/ui/card';

<Card>
  <CardHeader>
    <CardTitle>Card Title</CardTitle>
    <CardDescription>Card description goes here</CardDescription>
  </CardHeader>
  <CardContent>
    <p>Card content goes here</p>
  </CardContent>
  <CardFooter>
    <Button>Action</Button>
  </CardFooter>
</Card>
```

### Form with Input
```tsx
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

<div>
  <Label htmlFor="email">Email</Label>
  <Input id="email" type="email" placeholder="Enter your email" />
</div>
```

### Tabs
```tsx
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';

<Tabs defaultValue="tab1">
  <TabsList>
    <TabsTrigger value="tab1">Tab 1</TabsTrigger>
    <TabsTrigger value="tab2">Tab 2</TabsTrigger>
  </TabsList>
  <TabsContent value="tab1">
    Content for tab 1
  </TabsContent>
  <TabsContent value="tab2">
    Content for tab 2
  </TabsContent>
</Tabs>
```

## Import Paths

All components use the `@/` alias which maps to `src/renderer/`:
- `@/components/ui/*` - UI components
- `@/lib/utils` - Utility functions (includes `cn()` for className merging)

## Styling

Components use:
- **Tailwind CSS** for styling
- **CSS Variables** for theming (defined in `src/renderer/styles/globals.css`)
- **tailwindcss-animate** for animations
- **class-variance-authority** for variant management

## Configuration

- `components.json` - shadcn/ui configuration
- `tailwind.config.js` - Tailwind configuration with theme variables
- `tsconfig.json` - TypeScript path aliases

## Next Steps

1. Add `<Toaster />` to your app root for toast notifications
2. Customize theme colors in `src/renderer/styles/globals.css`
3. Import and use components as needed in your application
