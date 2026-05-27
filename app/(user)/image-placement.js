// image-placement has been removed — redirect any stale links to notifications
import { Redirect } from 'expo-router';
export default function ImagePlacementRedirect() {
  return <Redirect href="/(user)/notifications" />;
}
