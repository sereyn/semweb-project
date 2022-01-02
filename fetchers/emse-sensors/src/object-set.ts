
export default class ObjectSet<T> extends Set<T | string> {
    add(elem: T) {
        return super.add(typeof elem === 'object' ? JSON.stringify(elem) : elem);
    }
    has(elem: T) {
        return super.has(typeof elem === 'object' ? JSON.stringify(elem) : elem);
    }
}
