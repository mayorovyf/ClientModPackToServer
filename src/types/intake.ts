export type InstanceInputKind = 'instance' | 'mods-directory';
export type InstanceSource = 'direct' | 'mods-directory' | 'minecraft-subdir' | 'dot-minecraft-subdir';

export interface InstanceLayout {
    instancePath: string;
    modsPath: string;
    inputKind: InstanceInputKind;
    instanceSource: InstanceSource;
}
