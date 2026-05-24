export function hasKeys(object: Record<string, unknown>) {
	for (const key in object) if (Object.hasOwn(object, key)) return true;
	return false;
}
