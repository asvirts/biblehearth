/** Navigation decisions stay distinct from failures of the Scripture service. */
export class RouteControl extends Error {
	readonly routeControl = true;
	constructor(
		readonly status: number,
		readonly location?: string,
	) {
		super(location ? `Redirect to ${location}` : 'Page not found');
		this.name = 'RouteControl';
	}
}
export function isRouteControl(error: unknown): error is RouteControl {
	return (
		error instanceof RouteControl ||
		Boolean(
			error && typeof error === 'object' && 'routeControl' in error && error.routeControl === true,
		)
	);
}
